import { useCallback, useMemo } from 'react';
import Particles from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { Engine, ISourceOptions } from '@tsparticles/engine';

export function ParticleBackground() {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const options: ISourceOptions = useMemo(
    () => ({
      fullScreen: false,
      fpsLimit: 60,
      particles: {
        number: {
          value: 40,
          density: {
            enable: true,
          },
        },
        color: {
          value: '#6366f1',
        },
        opacity: {
          value: 0.08,
        },
        size: {
          value: { min: 1, max: 2 },
        },
        move: {
          enable: true,
          speed: 0.3,
          direction: 'none' as const,
          random: true,
          straight: false,
          outModes: {
            default: 'out' as const,
          },
        },
        links: {
          enable: true,
          distance: 150,
          color: '#6366f1',
          opacity: 0.04,
          width: 1,
        },
      },
      detectRetina: true,
    }),
    [],
  );

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      options={options}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
      }}
    />
  );
}
