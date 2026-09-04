const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

/**
 * Extra login state for a student account (kept out of Django's auth_user table).
 * - is_first_login: force password change after initial credential creation
 * - password_reset_token_hash/expires: reset flow for "forgot password"
 */
const StudentLoginMeta = sequelize.define(
  "tracker_student_login_meta",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    studentId: { type: DataTypes.STRING(50), allowNull: false },
    authUserId: { type: DataTypes.INTEGER, allowNull: true },

    isFirstLogin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true },
    emailSent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    passwordResetTokenHash: { type: DataTypes.STRING(128), allowNull: true },
    passwordResetTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "tracker_student_login_meta",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["studentId"] },
      { unique: true, fields: ["authUserId"] },
    ],
  }
);

module.exports = { StudentLoginMeta };

