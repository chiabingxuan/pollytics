import "./About.css";

const GITHUB_REPO_URL: string = "https://github.com/chiabingxuan/pollytics/tree/main";
const LINKEDIN_URL: string = "https://www.linkedin.com/in/bing-xuan-chia/";

function About() {
    return (
        <section className="about">
            <h2>About the Site</h2>
            <p>
                <i>pollytics</i> is a platform which gives users the freedom to explore election results from countries all around the world. By delving into election data through interactive maps and a helpful assistant, users are able to learn more about key voting trends, thereby gaining a better understanding of a country's political climate.
            </p>
            <p>
                The GitHub repository for <i>pollytics</i> can be found <a href={GITHUB_REPO_URL} target="_blank">here</a>.
            </p>
            <h2>About the Name</h2>
            <p>
                <i>pollytics</i> makes reference to three words: <i>poll</i>, <i>analytics</i> and <i>politics</i>. I find it important to mention the origin of this name, because I coined it without the help of AI. I'll never reach such levels of creativity ever again.
            </p>
            <h2>About Me</h2>
            <p>
                Heya, I'm Bing Xuan, a graduate student at the National University of Singapore. I'm currently pursuing a Masters of Science in Business Analytics.
            </p>
            <p>
                Feel free to connect with me on <a href={LINKEDIN_URL} target="_blank">LinkedIn</a>!
            </p>
        </section>
    );
}

export default About;