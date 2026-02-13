import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="nav">
      <Link className="brand" to="/">
        FieldFriends
      </Link>
      <nav>
        <NavLink to="/">Events</NavLink>
        {user ? <NavLink to="/events/new">Create Event</NavLink> : null}
        {user ? <NavLink to="/my-events">My Events</NavLink> : null}
      </nav>
      <div className="auth-actions">
        {user ? (
          <>
            <span>{user.email}</span>
            <button type="button" onClick={logout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/signup">Signup</NavLink>
          </>
        )}
      </div>
    </header>
  );
}
