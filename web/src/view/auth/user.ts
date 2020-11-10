import * as React from 'react'
import { FetchUserContext_self, UserType } from '../../graphql/query.gen'

export class UserCtx {
  constructor(public user: FetchUserContext_self | null) {}
  isAdmin() {
    return this.user && this.user?.userType === UserType.ADMIN
  }
  isLoggedIn() {
    return Boolean(this.user)
  }
  displayName() {
    return this.user?.name
  }
  displayId() {
    return this.user?.id
  }
}

export const UserContext = React.createContext<UserCtx>(new UserCtx(null))
