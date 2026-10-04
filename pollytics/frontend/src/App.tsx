import { Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import Nav from "./components/Nav";
import About from "./pages/About";
import Home from "./pages/Home";
import IndivElection from "./pages/IndivElection";
import "./App.css";

function App() {
    return (
        <>
            <Header />
            <Nav />
            <main className="app">
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
