import { z } from "zod/v4";

export const ExchangeMobileAuthorizationCodeBody = z.object({
  code: z.string(),
  code_verifier: z.string(),
  redirect_uri: z.string(),
  state: z.string(),
  nonce: z.string().nullish(),
});

export const ExchangeMobileAuthorizationCodeResponse = z.object({
  token: z.string(),
});

export const LogoutMobileSessionResponse = z.object({
  success: z.boolean(),
});
