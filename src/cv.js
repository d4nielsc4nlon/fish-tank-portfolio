// cv.js
import './about.js';

document.querySelectorAll('a').forEach(link => {
  link.addEventListener('mouseenter', () => {
    const bubble = document.createElement('div');

    bubble.style.position = 'fixed';
    bubble.style.width = '6px';
    bubble.style.height = '6px';
    bubble.style.borderRadius = '50%';
    bubble.style.background = 'rgba(200,230,255,0.7)';
    bubble.style.pointerEvents = 'none';
    bubble.style.zIndex = '999';

    const rect = link.getBoundingClientRect();

    bubble.style.left = rect.left + rect.width / 2 + 'px';
    bubble.style.top = rect.top + 'px';

    document.body.appendChild(bubble);

    bubble.animate(
      [
        { transform: 'translateY(0px)', opacity: 1 },
        { transform: 'translateY(-20px)', opacity: 0 }
      ],
      {
        duration: 600,
        easing: 'ease-out'
      }
    );

    setTimeout(() => bubble.remove(), 600);
  });
});

// smooth scroll-driven subtle camera drift (optional but recommended)

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;

  camera.position.z = 12 + scrollY * 0.002;
  camera.position.y = -1 + scrollY * 0.0005;
});