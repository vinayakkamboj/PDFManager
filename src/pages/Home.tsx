import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, FileText, Shield, Zap, Users } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Easy to Use",
    description: "Intuitive interface designed for everyone"
  },
  {
    icon: Shield,
    title: "Secure",
    description: "Your documents are safe and private"
  },
  {
    icon: Zap,
    title: "Fast",
    description: "Process PDFs in seconds, not minutes"
  },
  {
    icon: Users,
    title: "Collaborative",
    description: "Share and work together seamlessly"
  }
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Animated background elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -left-4 top-1/4 h-96 w-96 animate-pulse rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-4 bottom-1/4 h-96 w-96 animate-pulse rounded-full bg-secondary/10 blur-3xl delay-1000" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-accent/5 blur-3xl delay-500" />
      </div>
      
      {/* Hero Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="mb-16 text-center animate-fade-in">
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Manage Your PDFs
            <span className="block mt-2 bg-gradient-to-r from-primary via-primary/80 to-secondary bg-clip-text text-transparent">
              With Ease
            </span>
          </h1>
          
          <p className="mb-10 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto">
            Powerful tools to edit, organize, and optimize your PDF documents.
            Everything you need in one professional platform.
          </p>
          
          <Button 
            size="lg" 
            onClick={() => navigate("/explore")}
            className="group h-14 gap-2 px-8 text-lg shadow-lg transition-all hover:shadow-xl hover:scale-105 animate-scale-in"
          >
            Explore Tools
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={feature.title}
                className="p-6 text-center hover:shadow-lg transition-all duration-300 hover:scale-105 border-border/50 bg-card/50 backdrop-blur-sm"
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Home;
