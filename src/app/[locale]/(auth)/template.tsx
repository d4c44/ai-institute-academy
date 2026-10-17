// A template is re-mounted on every navigation (a layout is not), which replays this entrance.
// `motion-safe:` turns it off for visitors who asked their system to reduce motion.
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500 motion-safe:ease-out">
      {children}
    </div>
  );
}