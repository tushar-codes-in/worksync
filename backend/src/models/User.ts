import { Schema, model, Types, type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface UserDoc extends Document {
  _id: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

interface UserModel extends Model<UserDoc> {
  hashPassword(plain: string): Promise<string>;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String },
  },
  { timestamps: true },
);

userSchema.method('comparePassword', async function (password: string) {
  return bcrypt.compare(password, this.passwordHash);
});

userSchema.static('hashPassword', async function (plain: string) {
  return bcrypt.hash(plain, 12);
});

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).passwordHash;
    return ret;
  },
});

export const User = model<UserDoc, UserModel>('User', userSchema);
