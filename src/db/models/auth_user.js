const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

// Django's `auth_user` table (no need to model everything; only fields we use).
const AuthUser = sequelize.define(
  "auth_user",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    password: { type: DataTypes.STRING(128), allowNull: false },
    username: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    is_staff: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_superuser: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    role: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "student" },
    department: { type: DataTypes.STRING(50), allowNull: true },
    email: { type: DataTypes.STRING(254), allowNull: true },
    first_name: { type: DataTypes.STRING(150), allowNull: true },
    last_name: { type: DataTypes.STRING(150), allowNull: true },
    date_joined: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "auth_user",
    timestamps: false,
  }
);

module.exports = { AuthUser };

