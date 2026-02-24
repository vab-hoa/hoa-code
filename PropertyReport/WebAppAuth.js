/**
 * Web App Authorization
 * Determines user role based on Google Group membership.
 * Roles: 'board', 'owner', 'none'
 */

/**
 * Return the role of the given email address.
 * Board is checked first — board members are typically also HOA owners
 * and should get the enhanced UI.
 *
 * @param {string} email
 * @return {string} 'board' | 'owner' | 'none'
 */
function getUserRole(email) {
  if (!email) return 'none';
  if (HOALibrary.isBoardMember(email)) return 'board';
  if (HOALibrary.isHOAOwner(email)) return 'owner';
  return 'none';
}
