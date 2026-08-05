import bcrypt from 'bcrypt';
import { User, UserRole } from '../models/User';
import { encryptAES, decryptAES, hashDeterministic } from '../utils/encryption';

const SALT_ROUNDS = 10;

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SafeUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export class EmailAlreadyExistsError extends Error {}
export class InvalidCredentialsError extends Error {}

export class UserService {
  public async register(input: RegisterInput): Promise<SafeUser> {
    const emailHash = hashDeterministic(input.email);

    const existing = await User.findOne({ where: { emailHash } });
    if (existing) {
      throw new EmailAlreadyExistsError('Ya existe un usuario con este correo.');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await User.create({
      nameEncrypted: encryptAES(input.name),
      emailEncrypted: encryptAES(input.email),
      emailHash,
      passwordHash,
      role: input.role,
    });

    return this.toSafeUser(user);
  }

  public async login(input: LoginInput): Promise<SafeUser> {
    const emailHash = hashDeterministic(input.email);
    const user = await User.findOne({ where: { emailHash } });

    if (!user) {
      throw new InvalidCredentialsError('Correo o contraseña incorrectos.');
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError('Correo o contraseña incorrectos.');
    }

    return this.toSafeUser(user);
  }

  public async findById(id: number): Promise<SafeUser | null> {
    const user = await User.findByPk(id);
    if (!user) return null;
    return this.toSafeUser(user);
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: decryptAES(user.nameEncrypted),
      email: decryptAES(user.emailEncrypted),
      role: user.role,
    };
  }
}