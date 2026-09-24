import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export default function useReveal(root, key) {
  useEffect(() => {
    if (!key) return;
    const match = gsap.matchMedia();
    match.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.utils.toArray('[data-reveal]').forEach(element => gsap.from(element, { opacity: 0, y: 25, rotationX: 4, transformPerspective: 1000, duration: 0.65, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 96%', once: true } }));
      }, root);
      return () => context.revert();
    });
    return () => match.revert();
  }, [root, key]);
}
