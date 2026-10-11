import { Route, Routes } from "react-router-dom";

import Banner from "./components/Banner";
import About from "./pages/About";
import Home from "./pages/Home";
import IndivElection from "./pages/IndivElection";

import "./App.css";

function App() {
    return (
        <>
            <Banner />
            <main className="page-content">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboards/:electionId" element={<IndivElection />} />
                    <Route path="/about" element={<About />} />
                </Routes>
            </main>
        </>
    );
}

export default App;
