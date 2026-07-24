import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">ShowGather</h1>
        <p className="text-slate-500 mb-6">Live sports presentation viewer</p>
        <div className="flex gap-4 justify-center">
          <Link href="/demo" className="px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 transition">
            Demo
          </Link>
        </div>
      </div>
    </main>
  );
}
