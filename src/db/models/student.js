const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const Student = sequelize.define(
  "tracker_student",
  {
    student_id: { type: DataTypes.STRING(50), primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: true },
    gender: { type: DataTypes.STRING(10), allowNull: true },
    date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
    email: { type: DataTypes.STRING(254), allowNull: true },
    phone_number: { type: DataTypes.STRING(20), allowNull: true },
    branch: { type: DataTypes.STRING(100), allowNull: true },
    year: { type: DataTypes.STRING(20), allowNull: true },
    cgpa: { type: DataTypes.DECIMAL(4, 2), allowNull: true },
    backlogs: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    address: { type: DataTypes.TEXT, allowNull: true },
    skills: { type: DataTypes.TEXT, allowNull: true },
    additional_skills: { type: DataTypes.TEXT, allowNull: true },
    certifications: { type: DataTypes.TEXT, allowNull: true },
    resume_link: { type: DataTypes.STRING(200), allowNull: true },
    linkedin: { type: DataTypes.STRING(200), allowNull: true },
    github: { type: DataTypes.STRING(200), allowNull: true },
    profile_photo: { type: DataTypes.STRING(100), allowNull: true },

    placement_status: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "Not Placed" },
    placement_company: { type: DataTypes.STRING(100), allowNull: true },
    placement_package: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    placement_year: { type: DataTypes.STRING(10), allowNull: true },

    profileVerificationStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Pending",
    },
    verificationRemarks: { type: DataTypes.TEXT, allowNull: true },
    verifiedBy: { type: DataTypes.STRING(150), allowNull: true },

    user_id: { type: DataTypes.INTEGER, allowNull: true },

    smtp_host: { type: DataTypes.STRING(200), allowNull: true },
    smtp_port: { type: DataTypes.INTEGER, allowNull: true },
    smtp_secure: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    smtp_user: { type: DataTypes.STRING(200), allowNull: true },
    smtp_pass: { type: DataTypes.STRING(200), allowNull: true },
    mail_from: { type: DataTypes.STRING(200), allowNull: true },
  },
  {
    tableName: "tracker_student",
    timestamps: false,
  }
);

module.exports = { Student };

