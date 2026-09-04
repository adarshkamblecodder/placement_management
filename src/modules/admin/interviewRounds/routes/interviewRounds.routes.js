const express = require("express");
const { Op } = require("sequelize");
const {
  InterviewRound,
  StudentRoundResult,
  PlacementDrive,
  Company,
  Student,
  ShortlistStudent,
  Shortlist,
} = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");

const router = express.Router();
router.use(requireAdmin);

function isQualified(result) {
  return result === "Qualified" || result === "Passed";
}

/**
 * Called after every round result save.
 * Updates ShortlistStudent.status for this specific drive (per-drive status).
 * Only updates Student.placement_status globally when:
 *   - All rounds qualified → "Placed"
 *   - Never writes intermediate statuses to the Student record.
 */
async function syncStudentStatus(studentId, roundId) {
  try {
    const round = await InterviewRound.findByPk(roundId);
    if (!round) return;

    const drive = await PlacementDrive.findByPk(round.driveId, {
      include: [{ model: Company, as: "company" }],
    });

    const allRoundsInDrive = await InterviewRound.findAll({
      where: { driveId: round.driveId },
      order: [["order", "ASC"]],
    });

    const allRoundIds = allRoundsInDrive.map((r) => r.id);

    const results = await StudentRoundResult.findAll({
      where: { roundId: { [Op.in]: allRoundIds }, studentId },
    });

    const resultMap = {};
    results.forEach((r) => {
      resultMap[r.roundId] = r.result;
    });

    let isRejected = false;
    let allRoundsQualified = allRoundsInDrive.length > 0;

    for (const r of allRoundsInDrive) {
      const res = resultMap[r.id];
      if (res === "Rejected") {
        isRejected = true;
        allRoundsQualified = false;
        break;
      } else if (!isQualified(res)) {
        // Pending or no result yet
        allRoundsQualified = false;
      }
    }

    // ── Determine the per-drive ShortlistStudent status ─────────────────────
    let newShortlistStatus = null;
    if (isRejected) {
      newShortlistStatus = "Rejected";
    } else if (allRoundsQualified) {
      newShortlistStatus = "Selected"; // all rounds passed — TPO confirms offer separately
    }
    // If neither rejected nor all-qualified, status stays "Shortlisted" (rounds ongoing)

    // Find all ShortlistStudent records for this student in shortlists of this drive
    if (newShortlistStatus) {
      const shortlistsForDrive = await Shortlist.findAll({
        where: { driveId: round.driveId },
        attributes: ["id"],
      });
      const shortlistIds = shortlistsForDrive.map((s) => s.id);

      if (shortlistIds.length > 0) {
        await ShortlistStudent.update(
          { status: newShortlistStatus },
          {
            where: {
              studentId: String(studentId),
              shortlistId: { [Op.in]: shortlistIds },
              // Don't overwrite if already Offer Declined or Withdrawn
              status: { [Op.notIn]: ["Offer Declined", "Withdrawn", "Absent"] },
            },
          }
        );
      }
    }

    // ── Update global Student.placement_status ───────────────────────────────
    // ONLY set "Placed" when all rounds passed. Never set intermediate strings.
    if (!isRejected && allRoundsQualified) {
      const companyName  = drive?.company?.name || null;
      const packageLPA   = drive?.packageLPA || null;
      const placementYear = new Date().getFullYear().toString();

      await Student.update(
        {
          placement_status:  "Placed",
          placement_company: companyName,
          placement_package: packageLPA,
          placement_year:    placementYear,
        },
        { where: { student_id: String(studentId) } }
      );
    }
    // If rejected: leave Student.placement_status as-is ("Not Placed").
    // The per-drive rejection is recorded on ShortlistStudent.status = "Rejected".

  } catch (err) {
    console.error("syncStudentStatus error:", err);
  }
}

router.get("/:driveId/rounds", async (req, res) => {
  try {
    const rounds = await InterviewRound.findAll({
      where: { driveId: Number(req.params.driveId) },
      order: [["order", "ASC"]],
    });
    return res.json({ success: true, rounds });
  } catch (err) {
    console.error("GET rounds error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:driveId/student-results/:studentId", async (req, res) => {
  try {
    const driveId = Number(req.params.driveId);
    const studentId = req.params.studentId;

    const drive = await PlacementDrive.findByPk(driveId);
    const driveInterviewDate = drive?.interviewDate || null;

    const rounds = await InterviewRound.findAll({
      where: { driveId },
      order: [["order", "ASC"]],
    });

    const roundIds = rounds.map((r) => r.id);

    const existingResults = await StudentRoundResult.findAll({
      where: { roundId: { [Op.in]: roundIds }, studentId },
    });

    const resultMap = {};
    existingResults.forEach((r) => {
      resultMap[r.roundId] = {
        result: r.result,
        rejectionReason: r.rejectionReason || "",
        notes: r.notes || "",
        remarks: r.remarks || "",
        // Use saved date; fall back to drive interview date for new records
        interviewDate: r.interviewDate || driveInterviewDate || "",
      };
    });

    const data = rounds.map((r) => ({
      id: r.id,
      roundName: r.roundName,
      // Use round-specific date if set, otherwise fall back to drive interview date
      roundDate: r.roundDate || driveInterviewDate || "",
      order: r.order,
      existingResult: resultMap[r.id] || {
        result: "Pending",
        rejectionReason: "",
        notes: "",
        remarks: "",
        // Pre-fill interview date from drive for new (unsaved) rounds
        interviewDate: driveInterviewDate || "",
      },
    }));

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        data[i].unlocked = true;
      } else {
        const prevRoundId = data[i - 1].id;
        const prevResult = resultMap[prevRoundId];
        data[i].unlocked = prevResult ? isQualified(prevResult.result) : false;
      }
    }

    return res.json({ success: true, rounds: data });
  } catch (err) {
    console.error("GET student-results error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/save-result", async (req, res) => {
  try {
    const { roundId, studentId, result, rejectionReason, notes, remarks, interviewDate } =
      req.body;

    if (!roundId || !studentId) {
      return res
        .status(400)
        .json({ success: false, message: "roundId and studentId are required." });
    }

    const validResults = ["Pending", "Passed", "Qualified", "Rejected"];
    if (result && !validResults.includes(result)) {
      return res
        .status(400)
        .json({ success: false, message: `Invalid result value: ${result}` });
    }

    const round = await InterviewRound.findByPk(Number(roundId));
    if (!round) {
      return res.status(404).json({ success: false, message: "Round not found." });
    }

    if (round.order > 1) {
      const prevRound = await InterviewRound.findOne({
        where: { driveId: round.driveId, order: round.order - 1 },
      });
      if (prevRound) {
        const prevResult = await StudentRoundResult.findOne({
          where: { roundId: prevRound.id, studentId: String(studentId) },
        });
        if (!prevResult || !isQualified(prevResult.result)) {
          return res.status(403).json({
            success: false,
            message: `Round ${round.order} is locked. Student must qualify Round ${
              round.order - 1
            } first.`,
          });
        }
      }
    }

    const [record, created] = await StudentRoundResult.findOrCreate({
      where: { roundId: Number(roundId), studentId: String(studentId) },
      defaults: {
        result: result || "Pending",
        rejectionReason: result === "Rejected" ? rejectionReason || null : null,
        notes: notes || null,
        remarks: remarks || null,
        interviewDate: interviewDate || null,
      },
    });

    if (!created) {
      await record.update({
        result: result || record.result,
        rejectionReason:
          result === "Rejected" ? rejectionReason || null : null,
        notes: notes !== undefined ? notes || null : record.notes,
        remarks: remarks !== undefined ? remarks || null : record.remarks,
        interviewDate:
          interviewDate !== undefined
            ? interviewDate || null
            : record.interviewDate,
      });
    }

    await syncStudentStatus(String(studentId), Number(roundId));

    const student = await Student.findOne({
      where: { student_id: String(studentId) },
      attributes: ["placement_status"],
    });

    // Fetch the updated ShortlistStudent status for this drive so frontend can reflect it
    const shortlistEntry = await ShortlistStudent.findOne({
      include: [{
        model: Shortlist,
        as: "shortlist",
        where: { driveId: round.driveId },
        required: true,
      }],
      where: { studentId: String(studentId) },
    }).catch(() => null);

    return res.json({
      success: true,
      message: "Round result saved successfully.",
      result: record.result,
      studentStatus: student?.placement_status || null,
      driveStatus: shortlistEntry?.status || null,
    });
  } catch (err) {
    console.error("save-result error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/:driveId/add-round", async (req, res) => {
  try {
    const driveId = Number(req.params.driveId);
    const { roundName, roundDate, order } = req.body;

    // Backend guard: adding rounds is not permitted for completed drives
    const drive = await PlacementDrive.findByPk(driveId);
    if (drive && drive.driveStatus === "completed") {
      return res.status(403).json({ success: false, message: "This action is unavailable for completed drives." });
    }

    if (!roundName || !roundName.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Round name is required." });
    }
    const orderInt = parseInt(order, 10);
    if (isNaN(orderInt) || orderInt < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Order must be a positive integer." });
    }

    const round = await InterviewRound.create({
      driveId,
      roundName: roundName.trim(),
      roundDate: roundDate || null,
      order: orderInt,
    });

    return res.json({ success: true, round: round.toJSON() });
  } catch (err) {
    console.error("POST add-round error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/:roundId/delete-round", async (req, res) => {
  try {
    const round = await InterviewRound.findByPk(Number(req.params.roundId));
    if (!round) {
      return res
        .status(404)
        .json({ success: false, message: "Round not found." });
    }
    await StudentRoundResult.destroy({ where: { roundId: round.id } });
    await round.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE round error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/student/:studentId/kundali", async (req, res) => {
  try {
    const results = await StudentRoundResult.findAll({
      where: { studentId: req.params.studentId },
      include: [
        {
          model: InterviewRound,
          as: "round",
          include: [
            {
              model: PlacementDrive,
              as: "drive",
              include: [{ model: Company, as: "company" }],
            },
          ],
        },
      ],
      order: [
        [{ model: InterviewRound, as: "round" }, "driveId", "DESC"],
        [{ model: InterviewRound, as: "round" }, "order", "ASC"],
      ],
    });

    const grouped = {};
    results.forEach((r) => {
      const round   = r.round;
      const drive   = round?.drive;
      const company = drive?.company;
      const driveId = round?.driveId ?? drive?.id;
      if (!driveId) return;

      if (!grouped[driveId]) {
        grouped[driveId] = {
          companyName: company?.name || "Unknown Company",
          jobRole: drive?.jobRole || "Unknown Role",
          interviewDate: drive?.interviewDate || null,
          rounds: [],
        };
      }
      grouped[driveId].rounds.push({
        roundName: round?.roundName,
        roundDate: round?.roundDate,
        order: round?.order,
        result: r.result,
        rejectionReason: r.rejectionReason,
        notes: r.notes,
        remarks: r.remarks,
        interviewDate: r.interviewDate,
      });
    });

    return res.json({ success: true, history: Object.values(grouped) });
  } catch (err) {
    console.error("kundali error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message });
  }
});

module.exports = router;
