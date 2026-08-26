import Image from "next/image";
import Link from "next/link";

const socials = [
  { name: "Discord", url: "https://discord.com/users/1453816643552547080" },
  { name: "TFT", url: "https://tactics.tools/player/euw/hubby/mine" },
 ];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-5xl items-center justify-center px-6 py-16 -translate-y-6 sm:-translate-y-8 lg:-translate-y-10">
        {/* Hero */}
        <header className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <div className="hero-card w-full">
            <h1 className="text-4xl font-extrabold leading-none tracking-tight hero-heading sm:text-5xl lg:text-6xl">
              Noise — linux enthusiast
            </h1>

            <div className="mt-6 flex flex-col items-center gap-6 md:flex-row md:items-center">
              <Image
                src="/osage-chan.gif"
                alt="osage chan"
                width={200}
                height={140}
                unoptimized
                className="rounded-full"
              />

              <div className="text-center md:text-left">
                <p className="text-lg">married to calm · double up enjoyer · gd player</p>
                <p className="mt-3 text-sm leading-7">
                  currently: clearing extreme demons on Geometry Dash, boosting TFT across every elo, and digging deeper into Linux.
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:justify-start md:text-left">
                    {socials.map((s) => (
                      <Link key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.name} className="text-link">
                        {s.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </main>

      {/* footer removed by request; social links are shown in the hero */}
    </div>
  );
}
