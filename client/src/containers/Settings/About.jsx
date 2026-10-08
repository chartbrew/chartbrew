import React, { useEffect, useState } from "react";
import { Button, Link, ProgressCircle } from "@heroui/react";
import {
  LuArrowUpRight,
  LuGithub,
  LuGlobe,
  LuHeartHandshake,
  LuNewspaper,
} from "react-icons/lu";

import { getPlatformSettings } from "../../api/platformSettings";
import AboutCup from "./AboutCup";

const LINK_ICONS = {
  website: LuGlobe,
  github: LuGithub,
  blog: LuNewspaper,
  sponsors: LuHeartHandshake,
};

function About() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getPlatformSettings());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <ProgressCircle aria-label="Loading About" />;
  }

  if (!data) {
    return (
      <div className="flex flex-wrap items-center gap-4" role="alert">
        <p>About could not be loaded. Try again.</p>
        <Button onPress={load} variant="secondary">Try again</Button>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-divider bg-surface">
      <div className="grid items-center gap-2 px-6 py-8 sm:px-10 lg:grid-cols-2 lg:gap-8 lg:px-12 lg:py-14">
        <AboutCup />
        <div className="pb-6 pt-4 lg:py-8">
          <h2 className="text-5xl font-semibold tracking-normal sm:text-6xl">Chartbrew</h2>
          <p className="mt-4 text-sm text-muted">Version {data.version}</p>
          <p className="mt-8 max-w-xs text-lg leading-8 text-muted">
            Created and maintained by{" "}
            <Link className="text-lg" href="https://x.com/razvanilin" rel="noopener noreferrer" target="_blank">
              Razvan Ilin
            </Link>
            .
          </p>
        </div>
      </div>
      <nav aria-label="Chartbrew links" className="grid gap-3 border-t border-divider p-6 sm:grid-cols-2 sm:px-10 lg:grid-cols-[1fr_1fr_1fr_1.4fr] lg:px-12">
        {data.links.map((link) => {
          const Icon = LINK_ICONS[link.id] || LuGlobe;
          return (
            <Link
              className="group !flex min-h-12 !w-full items-center gap-3 rounded-xl border border-transparent bg-surface-secondary px-4 py-3 text-sm font-medium !text-foreground !no-underline transition-colors hover:border-accent/20 hover:bg-accent-soft hover:!text-accent"
              href={link.url}
              key={link.id}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon aria-hidden="true" className="shrink-0 text-muted transition-colors group-hover:text-accent" size={18} />
              <span className="flex-1">{link.label}</span>
              <LuArrowUpRight aria-hidden="true" className="shrink-0 text-muted/60 transition-colors group-hover:text-accent" size={15} />
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

export default About;
