import { NavLink } from "react-router-dom";
import "./Nav.css";

function Nav() {
    return (
        <nav className="nav" aria-label="Main navigation">
            <ul>
                <li>
                    <NavLink to="/">Home</NavLink>
                </li>
                <li>
                    <NavLink to="/about">About</NavLink>
                </li>
            </ul>
        </nav>
    );
}

export default Nav;