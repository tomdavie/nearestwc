export const USER_POINTS_CHANGED_EVENT = 'nearestwc:user-points-changed'

export function notifyUserPointsChanged() {
  window.dispatchEvent(new CustomEvent(USER_POINTS_CHANGED_EVENT))
}
