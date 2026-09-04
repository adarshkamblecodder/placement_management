module.exports = {
  routes: require("./routes/student.routes"),
  internshipRoutes: require("./routes/internship.routes"),
  projectRoutes: require("./routes/project.routes"),
  controller: require("./controllers/studentProfile.controller"),
  services: {
    profile: require("./services/studentProfile.service"),
    resume: require("./services/resume.service"),
  },
  middleware: {
    requireStudent: require("./middleware/requireStudent").requireStudent,
  },
};
