import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center text-white">
            <Icon name="token" className="text-sm" />
          </div>
          <span className="font-bold text-lg text-gray-900">TOLLABS</span>
          <span className="text-sm text-gray-500 ml-2">© 2026</span>
        </div>
        <div className="flex gap-6 text-sm text-gray-500">
          <Link href="/settings" className="hover:text-gray-900">Settings</Link>
          <Link href="/marketplace" className="hover:text-gray-900">Marketplace</Link>
          <a href="https://x.com/tollabs" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900">Twitter</a>
          <a href="https://github.com/tollabs" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
