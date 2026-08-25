import Image from "next/image";
import Link from "next/link";

const projects = [
  {
    name: "Efrei international",
    url: "https://efrei-int-website-v2.vercel.app",
  },
];

const socials = [
  { name: "discord", url: "https://discordapp.com/users/239916257917272068" },
  { name: "linkedin", url: "https://www.linkedin.com/in/maxsreis" },
  { name: "github", url: "https://github.com/LightningMax" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-background text-foreground">
      <main className="flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="text-4xl font-normal tracking-tight text-black">Max</h1>

        <Image
          src="/osage-chan.gif"
          alt="osage chan"
          width={298}
          height={180}
          unoptimized
          className="rounded"
        />

        <p className="text-base">i like to build stuff</p>

        <section className="mt-8 flex w-full flex-col items-center gap-3">
          {projects.map((project) => (
            <Link
              key={project.url}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg text-black underline decoration-black underline-offset-4 transition-opacity hover:opacity-60"
            >
              {project.name}
            </Link>
          ))}
        </section>
      </main>

      <footer className="flex w-full max-w-xl items-center justify-center gap-6 px-6 py-8 text-sm">
        {socials.map((social) => (
          <Link
            key={social.name}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-black/60 transition-colors hover:text-black"
          >
            {social.name}
          </Link>
        ))}
      </footer>
    </div>
  );
}
