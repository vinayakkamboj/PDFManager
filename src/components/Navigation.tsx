// Navigation.tsx
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.jpg";

const Navigation = () => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">

        {/* Logo + Title */}
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <img 
            src={logo} 
            alt="Logo" 
            className="h-9 w-9 rounded object-cover"
          />
          <span className="text-md font-bold text-foreground">PDFManager</span>
        </Link>

        {/* Nav Items */}
        <div className="flex items-center gap-6">
          <Link to="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Home
          </Link>

          <Link to="/explore">
            <Button variant="default" size="sm">
              Explore Tools
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
