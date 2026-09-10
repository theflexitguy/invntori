export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="border-2 border-[#35B2FF] border-t-transparent rounded-full animate-spin"
    />
  );
}
