import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AuthGuard } from '@/components/AuthGuard';
import { useNavigate } from 'react-router-dom';

interface InsuranceCompany {
  id: string;
  name: string;
  logo_url: string;
}

interface InsurancePlan {
  plan_id: string;
  plan_name: string;
  plan_type: string;
  plan_number: string;
  description: string;
}

const Onboarding = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [hasExistingInsurance, setHasExistingInsurance] = useState(false);

  // Store insurance company, metal level, and plan
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedMetalLevel, setSelectedMetalLevel] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  // 1. On render fetch all companies from our current database
  useEffect(() => {
    if (!user) return;
    fetchCompanies();
    checkExistingInsurance();
  }, [user]);

  // Check if user already has insurance data (coming from dashboard to change plan)
  const checkExistingInsurance = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_insurance')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      // If we get data without error, user has existing insurance
      setHasExistingInsurance(!!data && !error);
      console.log("User has existing insurance?", hasExistingInsurance)
    } catch (error) {
      // If there's an error (like no record found), user doesn't have existing insurance
      setHasExistingInsurance(false);
    }
  };

  // Helper function to grab companies
  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('insurance_companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: "Error loading insurance companies",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Helper function to grab insurance company's plans
  const fetchPlans = async (company_name: string, metal_level: string) => {
    try {
      const { data, error } = await supabase
        .from('insurance_plans')
        .select('*')
        .eq('company', company_name)
        .eq('metal_level', metal_level)
        .order('plan_name');

      if (error) {
        throw error;
      } else {
        console.log(data);
        setPlans(data || []);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: "Error loading insurance plans",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // 2. Set the selected company, metal level, and plan
  const handleCompanySelect = async (company_name: string) => {
    setSelectedCompany(company_name);
    setSelectedMetalLevel('');
    setStep(2);
  };

  // 3. Set the selected metal level, fetch plans, and move to plan selection
  const handleMetalLevelSelect = async (metal_level: string) => {
    console.log(metal_level)
    setSelectedMetalLevel(metal_level);
    await fetchPlans(selectedCompany, metal_level);
    setStep(3);
  };

  // 4. Complete user's insurance plan setup by:
  //    1. Creating or updating the user's plans in supabase
  //    2. Redirecting to dashboard accordingly or display error message
  const handleComplete = async () => {
    if (!user || !selectedCompany || !selectedMetalLevel || !selectedPlan) return;

    try {
      setLoading(true);

      // Create or update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name,
        }, {
          onConflict: 'user_id',
        });

      if (profileError) throw profileError;

      // Create or update insurance selection
      const { error: insuranceError } = await supabase
        .from('user_insurance')
        .upsert({
          user_id: user.id,
          company_name: selectedCompany,
          plan_id: selectedPlan,
          }, {
            onConflict: 'user_id',
        });

      if (insuranceError) throw insuranceError;

      // Set flag for dashboard to show success toast after loading
      localStorage.setItem('justCompletedOnboarding', 'true');
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Setup failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedCompanyData = companies.find(c => c.id === selectedCompany);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary-glow rounded-xl flex items-center justify-center shadow-[var(--shadow-healthcare)]">
              <span className="text-xl font-bold text-primary-foreground">OC</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Set up your profile</h1>
              <p className="text-muted-foreground">Help us personalize your healthcare experience</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center justify-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-8 h-px ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-8 h-px ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          </div>

          {/* Step 1: Insurance Company */}
          {step === 1 && (
            <Card className="shadow-[var(--shadow-card)] border-0 bg-gradient-to-br from-card to-card/50">
              <CardHeader className="text-center relative">
                {hasExistingInsurance && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/dashboard')}
                    className="absolute left-0 top-0 p-2 text-3xl hover:bg-transparent hover:text-inherit hover:text-blue-500"
                  >
                    ←
                  </Button>
                )}
                <CardTitle>Select your insurance company</CardTitle>
                <CardDescription>
                  Choose your current health insurance provider
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Group companies by first letter */}
                {Object.entries(
                  companies.reduce((acc, company) => {
                    const firstLetter = company.name.charAt(0).toUpperCase();
                    if (!acc[firstLetter]) {
                      acc[firstLetter] = [];
                    }
                    acc[firstLetter].push(company);
                    return acc;
                  }, {} as Record<string, InsuranceCompany[]>)
                )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([letter, companiesInSection]) => (
                  <div key={letter} className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                      {letter}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {companiesInSection.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => handleCompanySelect(company.name)} // Handle storing company when selected
                          className="p-6 border-2 border-border rounded-lg hover:border-primary hover:shadow-[var(--shadow-hover)]
                                     transition-[var(--transition-healthcare)] text-left space-y-3"
                        >
                          <div className="flex items-center space-x-3">
                            <img
                              src={company.logo_url}
                              alt={company.name}
                              className="w-12 h-12 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div>
                              <h3 className="font-semibold text-foreground">{company.name}</h3>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Metal Level */}
          {step === 2 && (
            <Card className="shadow-[var(--shadow-card)] border-0 bg-gradient-to-br from-card to-card/50">
              <CardHeader className="text-center relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="absolute left-0 top-0 p-2 text-3xl hover:bg-transparent hover:text-inherit hover:text-blue-500"
                >
                  ←
                </Button>
                <CardTitle>Select your metal level</CardTitle>
                <CardDescription>
                  Choose the coverage level that best fits your needs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedCompanyData && (
                  <div className="flex items-center justify-center space-x-3 p-4 bg-accent rounded-lg">
                    <img
                      src={selectedCompanyData.logo_url}
                      alt={selectedCompanyData.name}
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="font-medium text-accent-foreground">{selectedCompanyData.name}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { 
                      name: 'Expanded Bronze', 
                      description: 'Lower premiums, higher deductibles. Good for healthy individuals.',
                      emoji: '🥉'
                    },
                    { 
                      name: 'Silver', 
                      description: 'Balanced premiums and deductibles. Most popular choice.',
                      emoji: '🥈'
                    },
                    { 
                      name: 'Gold', 
                      description: 'Higher premiums, lower deductibles. Good for frequent care.',
                      emoji: '🥇'
                    },
                    { 
                      name: 'Platinum', 
                      description: 'Highest premiums, lowest deductibles. Maximum coverage.',
                      emoji: '💎'
                    }
                  ].map((level) => (
                    <button
                      key={level.name}
                      onClick={() => handleMetalLevelSelect(level.name)}
                      className={`p-6 border-2 rounded-lg transition-[var(--transition-healthcare)] text-left space-y-3 ${
                        selectedMetalLevel === level.name
                          ? 'border-primary bg-primary/5 shadow-[var(--shadow-hover)]' 
                          : 'border-border hover:border-primary hover:shadow-[var(--shadow-hover)]'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{level.emoji}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{level.name}</h3>
                          <p className="text-sm text-muted-foreground">{level.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Insurance Plan */}
          {step === 3 && (
            <Card className="shadow-[var(--shadow-card)] border-0 bg-gradient-to-br from-card to-card/50">
              <CardHeader className="text-center relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="absolute left-0 top-0 p-2 text-3xl hover:bg-transparent hover:text-inherit hover:text-blue-500"
                >
                  ←
                </Button>
                <CardTitle>Select your insurance plan</CardTitle>
                <CardDescription>
                  Choose your specific {selectedMetalLevel?.replace('_', ' ')} plan with {selectedCompanyData?.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedCompanyData && (
                  <div className="flex items-center justify-center space-x-3 p-4 bg-accent rounded-lg">
                    <img
                      src={selectedCompanyData.logo_url}
                      alt={selectedCompanyData.name}
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="font-medium text-accent-foreground">{selectedCompanyData.name}</span>
                  </div>
                )}

                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose your insurance plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.length > 0 ? (
                      plans.map((plan) => (
                        <SelectItem value={plan.plan_id}>
                          <div className="text-left">
                            <div className="font-medium">{plan.plan_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {plan.plan_type} • Plan #{plan.plan_number}
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-plans" disabled>
                        <div className="text-left">
                          No plans available for this combination
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <div className="flex justify-center">
                  <Button
                    variant="healthcare"
                    onClick={handleComplete}
                    disabled={!selectedPlan || loading}
                    className="hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                        Setting up...
                      </>
                    ) : (
                      'Complete Setup'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AuthGuard>
  );
};

export default Onboarding;