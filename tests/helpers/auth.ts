import jwt from "jsonwebtoken";

export function makeTestToken(userId = "user-1") {
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: "1h" });
}