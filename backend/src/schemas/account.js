import { z } from 'zod'

/**
 * DELETE /api/account takes no input. The only user that can ever be deleted
 * is auth.uid() inside the database function, so any body — especially one
 * naming a user id — is rejected outright rather than ignored.
 */
export const deleteAccountBody = z.object({}).strict()
