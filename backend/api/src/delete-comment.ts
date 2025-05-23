import { isAdminId, isModId } from 'common/envs/constants'
import {
  getContract,
  getUser,
  revalidateContractStaticProps,
} from 'shared/utils'
import { getComment } from 'shared/supabase/contract-comments'
import { createSupabaseDirectClient } from 'shared/supabase/init'
import { updateData } from 'shared/supabase/utils'
import { APIError, type APIHandler } from './helpers/endpoint'

export const deleteComment: APIHandler<'delete-comment'> = async (
  { commentPath },
  auth
) => {
  const [, contractId, , commentId] = commentPath.split('/')
  if (!contractId || !commentId) {
    throw new APIError(
      400,
      'Invalid comment path. If you can read this, tell sinclair to change this endpoint to have more sensible inputs'
    )
  }

  const pg = createSupabaseDirectClient()
  const user = await getUser(auth.uid)
  if (!user) throw new APIError(404, 'User not found')
  if (user.isBannedFromPosting || user.userDeleted)
    throw new APIError(
      403,
      'You are banned from posting or your account has been deleted'
    )

  if (!isAdminId(auth.uid) && !isModId(auth.uid)) {
    throw new APIError(403, 'Only mods or admins can delete comments')
  }

  const contract = await getContract(pg, contractId)
  if (!contract) throw new APIError(404, 'Contract not found')

  const comment = await getComment(pg, commentId)

  const del = !comment.deleted
  await updateData(pg, 'contract_comments', 'comment_id', {
    comment_id: commentId,
    deleted: del,
    deletedTime: del ? Date.now() : undefined,
    deleterId: auth.uid,
  })

  await revalidateContractStaticProps(contract)
  return { success: true }
}
