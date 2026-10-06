// The Sidelnr icon: a bold white S and a red full stop on black. Drawn as a
// shape (not a font letter) so it stays bold everywhere. `maskable` adds the
// padding Android needs when it crops icons to a circle.
export function appIconSvg({ maskable = false }: { maskable?: boolean } = {}): string {
  const scale = maskable ? 0.74 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path transform="translate(-34 4)" d="M322 170 C312 141 282 128 242 128 C194 128 164 151 164 188 C164 226 198 238 242 248 C292 259 326 277 326 320 C326 362 291 386 242 386 C192 386 160 369 152 337"
      fill="none" stroke="#fff" stroke-width="76" stroke-linecap="butt"/>
    <circle cx="394" cy="372" r="38" fill="#e5334b"/>
  </g>
</svg>`;
}
