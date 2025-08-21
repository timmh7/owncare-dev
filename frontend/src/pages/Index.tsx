import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading OwnCare...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center space-y-12">
        {/* Logo and Brand */}
        <div className="space-y-6">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <img src="/owncare-logo.png" alt="OwnCare Logo" className="w-24 h-24 object-contain" />
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground">
              Welcome to <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">OwnCare</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your AI-powered healthcare plan advisor. Get personalized answers about your insurance coverage, 
              find providers, and understand your benefits with ease.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-6">
          <Button 
            variant="healthcare" 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="px-8 py-4 text-lg"
          >
            Get Started Today
          </Button>
          <p className="text-sm text-muted-foreground">
            Sign in with Google to access your personalized healthcare dashboard
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-4xl mx-auto">
          <div className="space-y-4 p-6 rounded-lg bg-card/50 border border-border/40">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-3xl">🤖</span>
            </div>
            <h3 className="text-xl font-semibold">AI-Powered Assistance</h3>
            <p className="text-muted-foreground">
              Get instant answers about your healthcare plan with our intelligent chatbot
            </p>
          </div>
          
          <div className="space-y-4 p-6 rounded-lg bg-card/50 border border-border/40">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-3xl">🏥</span>
            </div>
            <h3 className="text-xl font-semibold">Provider Network</h3>
            <p className="text-muted-foreground">
              Compatible with 140+ insurance companies and 4,500+ healthcare plans
            </p>
          </div>
          
          <div className="space-y-4 p-6 rounded-lg bg-card/50 border border-border/40">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-xl font-semibold">Coverage Insights</h3>
            <p className="text-muted-foreground">
              Understand your benefits, copays, deductibles, and coverage limits
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
