import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * We store a hash of the refresh token (not the raw JWT). On refresh:
 *   - decode JWT to find the document (by jti)
 *   - verify hash matches; if revoked, reject and (optionally) revoke the family
 * Rotation is enforced by marking `revokedAt` and storing `replacedByJti`.
 */
export interface RefreshTokenDoc extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  jti: string;
  tokenHash: string;
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByJti?: string;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true, index: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String },
    ip: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByJti: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index — Mongo will purge expired tokens automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<RefreshTokenDoc>('RefreshToken', refreshTokenSchema);
