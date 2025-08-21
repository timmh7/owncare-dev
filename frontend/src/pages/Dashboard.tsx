import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AuthGuard } from '@/components/AuthGuard';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// Defined type for user profile
type UserProfile = {
  full_name: string;
  email: string;
  company_name: string;
  company_logo_url: string;
  plan_name: string;
  plan_type: string;
  plan_number: string;
  sob_url: string;
}

const Dashboard = () => {
  // Dashboard variables
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsingPDF, setParsingPDF] = useState(false);
  const [sobUrl, setSobUrl] = useState<string | null>(null);

  // Fetch user profile on render
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!user || hasFetched.current) return;
    hasFetched.current = true;
    
    const initializeDashboard = async () => {
      try {
        await fetchUserProfile();
        await fetchUserSOB(user.id);
        
        // Check if we just completed onboarding and display the toast notification
        const justCompleted = localStorage.getItem('justCompletedOnboarding');
        if (justCompleted) {
          localStorage.removeItem('justCompletedOnboarding');
          toast({
            title: "Welcome to OwnCare!",
            description: "Your profile has been set up successfully.",
          });
        }
      } catch (error: any) {
        // Check if it's the "no profile yet" error
        if (error?.code === 'PGRST116') {
          console.log("Ignore errrors: New account creation, initializing dashboard is still in process...");
        } else {
          console.error('Error initializing dashboard:', error);
          toast({
            title: "Error loading dashboard",
            description: "Please try refreshing the page",
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    };
    
    initializeDashboard();
  }, [user]);


  // Helper function that sends user's SOB URL for processing
  const fetchUserSOB = async (userId: string) => {
    try {
      // Step 1: Query for sob_url
      const { data: planData, error: planError } = await supabase
        .from("user_insurance")
        .select(`
          insurance_plans (
            sob_url
          )
        `)
        .eq("user_id", userId)
        .single();

      if (planError) throw planError;

      const sobUrl = (planData.insurance_plans as any)?.sob_url;
      console.log("sobURL: " + sobUrl);
      if (!sobUrl) throw new Error("No SOB URL found for user");

      // Store SOB URL in state for loading screen access
      setSobUrl(sobUrl);

      // Step 2: Check if chunks already exist for this SOB URL
      const { data: existingChunks, error: chunksError } = await supabase
        .from("sob_embeddings")
        .select("embedding_id")  // just need to check existence
        .eq("sob_url", sobUrl)
        .limit(1);

      if (chunksError) throw chunksError;

      if (existingChunks && existingChunks.length > 0) {
        console.log("Chunks already exist for this SOB URL. Skipping PDF parsing.");
        return existingChunks; // or return early with whatever info you need
      }

      // Step 3: Send PDF URL for parsing only if no chunks exist
      console.log("No existing chunks found. Now attempting to parse PDF...");
      setParsingPDF(true); // Start parsing loading state
      
      const resp = await fetch(`${API_BASE}/api/extract-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl: sobUrl }),
      });


      if (!resp.ok) throw new Error('Failed to extract PDF');

      const result = await resp.json();
      console.log('Extraction result:', result);

      // TODO: Parse JSON and send to your chatbot context
      return result;

    } catch (err) {
      console.error("Error fetching user SOB:", err);
      throw err;
    } finally {
      setParsingPDF(false); // End parsing loading state
    }
  };


  const fetchUserProfile = async () => {
    try {
      // First, get user's profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user?.id)
        .single();

      // Error handling for getting profile
      if (profileError && profileError.code === 'PGRST116') {
        console.log("No profile found, redirecting to onboarding...");
        navigate('/onboarding');
        return;
      } else if (profileError) {
         throw profileError;
      }

      // Second, get user's insurance
      const { data: insuranceData, error: insuranceError } = await supabase
        .from('user_insurance')
        .select(`
          insurance_companies (
            name,
            logo_url
          ),
          insurance_plans (
            plan_name,
            plan_type,
            plan_number,
            sob_url
          )
        `)
        .eq('user_id', user?.id) // user_insurance.user_id = user.id
        .single();

      // Handle errors
      if (insuranceError && insuranceError.code === 'PGRST116') {
        navigate('/onboarding');
        return;
      } else if (insuranceError) {
        throw insuranceError;
      } else if (!insuranceData) {
        navigate('/onboarding');
        return;
      }

      // helper function to set the user's dashboard profile + insurance
      setProfile({
        full_name: profileData.full_name || 'User',
        email: profileData.email || user?.email || '',
        company_name: (insuranceData.insurance_companies as any).name,
        company_logo_url: (insuranceData.insurance_companies as any).logo_url,
        plan_name: (insuranceData.insurance_plans as any).plan_name,
        plan_type: (insuranceData.insurance_plans as any).plan_type,
        plan_number: (insuranceData.insurance_plans as any).plan_number,
        sob_url: (insuranceData.insurance_plans as any).sob_url,
        //plan_description: (insuranceData.insurance_plans as any).description,
      });

    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error loading profile",
        description: "Please try refreshing the page",
        variant: "destructive",
      });
      throw error; // Re-throw to be handled by the caller
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign out failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleChangePlan = () => {
    navigate('/onboarding');
  };

  const handleStartChat = () => {
    navigate('/chat');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          {parsingPDF ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-muted-foreground">Processing your insurance plan...</p>
                <p className="text-sm text-muted-foreground/80">
                  One moment, we're parsing and analyzing your insurance plan to enable personalized assistance...
                </p>
              </div>
              {sobUrl && (
                <div className="flex flex-col items-center space-y-3">
                  <p className="text-sm text-muted-foreground/80">
                    For now, please take a look at your summary of benefits here:
                  </p>
                  <Button
                    variant="healthcare"
                    onClick={() => window.open(sobUrl, '_blank')}
                    className="flex items-center space-x-2 hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Summary of Benefits</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Loading your dashboard...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
        {/* Header */}
        <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <img src="/owncare-logo.png" alt="OwnCare Logo" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">OwnCare</h1>
                <p className="text-sm text-muted-foreground">Healthcare Plan Advisor</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">
              Welcome back, {profile?.full_name}!
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Your personalized healthcare dashboard is ready. Ask questions about your plan, 
              find providers, or get help understanding your benefits.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Card */}
          <Card className="shadow-[var(--shadow-card)] border-0 bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between md:pt-2">
                <span>Your Profile</span>
              </CardTitle>
              <CardDescription className="md:pt-1">
                Your account and personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{profile?.full_name}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{profile?.email}</p>
              </div>
            </CardContent>
          </Card>

            {/* Insurance Card */}
            <Card className="shadow-[var(--shadow-card)] border-0 bg-gradient-to-br from-card to-card/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Your Insurance Plan</span>
                  <Button variant="outline" size="sm" onClick={handleChangePlan}>
                    Change Plan
                  </Button>
                </CardTitle>
                <CardDescription>Your current healthcare coverage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <img
                    src={profile?.company_logo_url}
                    alt={profile?.company_name}
                    className="w-12 h-12 object-contain rounded-lg bg-background p-2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <h3 className="font-semibold">{profile?.company_name}</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">{profile?.plan_name}</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm text-muted-foreground">Plan Number: {profile?.plan_number}</p>
                    <Badge variant="secondary">{profile?.plan_type}</Badge>
                  </div>
                </div>
                
                {/* Summary of Benefits Link */}
                {profile?.sob_url && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(sobUrl, '_blank')}
                      className="w-full flex items-center justify-center space-x-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View Summary of Benefits</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Chat Card */}
          <Card className="shadow-[var(--shadow-card)] border-0 bg-gradient-to-br from-primary/5 via-card to-card">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Ask About Your Plan</CardTitle>
              <CardDescription className="text-lg">
                Get instant answers about your healthcare benefits, coverage, and more
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-primary text-xl">🏥</span>
                  </div>
                  <p className="font-medium">Understand Services</p>
                  <p className="text-muted-foreground">Learn what services are covered</p>
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-primary text-xl">💊</span>
                  </div>
                  <p className="font-medium">Check Coverage</p>
                  <p className="text-muted-foreground">Understand your benefits and costs</p>
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-primary text-xl">📋</span>
                  </div>
                  <p className="font-medium">Plan Details</p>
                  <p className="text-muted-foreground">Get help with claims and procedures</p>
                </div>
              </div>
              
              <Button 
                variant="healthcare" 
                size="lg" 
                onClick={handleStartChat}
                className="px-8 hover:scale-105 transition-transform duration-200 hover:shadow-lg"
              >
                Start Conversation
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
};

export default Dashboard;