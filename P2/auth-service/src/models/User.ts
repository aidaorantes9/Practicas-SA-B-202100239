import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type UserRole = 'admin' | 'cliente';

interface UserAttributes {
  id: number;
  nameEncrypted: string;
  emailEncrypted: string;
  emailHash: string;
  passwordHash: string;
  role: UserRole;
  createdAt?: Date;
}

type UserCreationAttributes = Optional<UserAttributes, 'id' | 'createdAt'>;

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: number;
  public nameEncrypted!: string;
  public emailEncrypted!: string;
  public emailHash!: string;
  public passwordHash!: string;
  public role!: UserRole;
  public readonly createdAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nameEncrypted: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    emailEncrypted: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    emailHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'cliente'),
      allowNull: false,
      defaultValue: 'cliente',
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    updatedAt: false,
  }
);