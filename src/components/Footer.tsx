// Footer.tsx
import logo from "@/assets/logo.jpg";

const Footer = () => {
  return (
    <footer className="w-full border-t border-border bg-card py-8">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">

          {/* Logo + Text */}
          <div className="flex items-center gap-2">
            <img 
              src={logo} 
              alt="Logo"
              className="h-8 w-8 rounded object-cover"   // <-- Bigger logo
            />
            <span className="text-sm font-semibold">PDFManager</span>
          </div>

          {/* Footer Links */}
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">About</a>
            <a href="#" className="transition-colors hover:text-foreground">Privacy</a>
            <a href="#" className="transition-colors hover:text-foreground">Terms</a>
            <a href="#" className="transition-colors hover:text-foreground">Contact</a>
          </div>

          <p className="text-sm text-muted-foreground">
            © 2025 PDFManager. All rights reserved.
          </p>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
