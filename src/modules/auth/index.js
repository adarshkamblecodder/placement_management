module.exports = {
  routes: require("./routes/auth.routes"),
  controller: require("./controllers/auth.controller"),
  services: {
    credentials: require("./services/credentials.service"),
    djangoPbkdf2: require("./services/djangoPbkdf2.service"),
  },
  validations: {
    passwordPolicy: require("./validations/passwordPolicy"),
  },
};
