"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ChevronDown,
  ChevronUp,
  Star,
  ExternalLink,
  Search,
  Filter,
  SlidersHorizontal,
  CheckCircle2,
  BookmarkPlus,
  Bookmark,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Briefcase,
  Clock,
  Layers,
  Zap,
  Scale,
  Sparkles,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useToast } from "@/hooks/use-toast"
import { useMobile } from "@/hooks/use-mobile"

// Define TypeScript interfaces for our data
interface Recommendation {
  name: string
  test_type: string
  duration: string
  job_levels: string
  languages: string
  description: string
  explanation: string
  url: string
  relevance_score?: number
}

// Wizard steps
const STEPS = {
  WELCOME: 0,
  QUERY: 1,
  RESULTS: 2,
}

export default function Home() {
  const { toast } = useToast()
  const isMobile = useMobile()

  // State management
  const [step, setStep] = useState(STEPS.WELCOME)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [, setError] = useState("")
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [filteredRecommendations, setFilteredRecommendations] = useState<Recommendation[]>([])
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({})
  const [comparisonList, setComparisonList] = useState<number[]>([])
  const [favorites, setFavorites] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const [showComparison, setShowComparison] = useState(false)

  // Filter and sort state
  const [sortBy, setSortBy] = useState("relevance")
  const [filterJobLevel, setFilterJobLevel] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Get unique test types for tabs
  const testTypes =
    recommendations.length > 0 ? ["all", ...Array.from(new Set(recommendations.map((rec) => rec.test_type)))] : ["all"]

  // // Get unique job levels for filtering
  // const jobLevels =
  //   recommendations.length > 0
  //     ? ["all", ...Array.from(new Set(recommendations.flatMap((rec) => rec.job_levels.split(", "))))]
  //     : ["all"]

  // Toggle card expansion
  const toggleCard = (index: number) => {
    setExpandedCards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  // Toggle comparison selection
  const toggleComparison = (index: number) => {
    setComparisonList((prev) => (prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]))
  }

  // Toggle favorite
  const toggleFavorite = (index: number) => {
    setFavorites((prev) => (prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]))

    toast({
      title: favorites.includes(index) ? "Removed from favorites" : "Added to favorites",
      description: favorites.includes(index)
        ? "Assessment removed from your saved list"
        : "Assessment saved for future reference",
      duration: 3000,
    })
  }

  // Filter recommendations based on search and filters
  useEffect(() => {
    if (recommendations.length === 0) return

    let filtered = [...recommendations]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (rec) =>
          rec.name.toLowerCase().includes(query) ||
          rec.description.toLowerCase().includes(query) ||
          rec.explanation.toLowerCase().includes(query) ||
          rec.test_type.toLowerCase().includes(query) ||
          rec.job_levels.toLowerCase().includes(query),
      )
    }

    // Apply tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter((rec) => rec.test_type === activeTab)
    }

    // Apply job level filter
    if (filterJobLevel !== "all") {
      filtered = filtered.filter((rec) => rec.job_levels.includes(filterJobLevel))
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === "relevance") {
        return (b.relevance_score || 0) - (a.relevance_score || 0)
      } else if (sortBy === "name") {
        return a.name.localeCompare(b.name)
      } else if (sortBy === "duration") {
        const getDurationMinutes = (duration: string) => {
          const match = duration.match(/(\d+)/)
          return match ? Number.parseInt(match[1]) : 0
        }
        return getDurationMinutes(a.duration) - getDurationMinutes(b.duration)
      }
      return 0
    })

    setFilteredRecommendations(filtered)
  }, [recommendations, searchQuery, activeTab, filterJobLevel, sortBy])

  // Handle form submission
  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    setRecommendations([])
    setFilteredRecommendations([])
    setExpandedCards({})
    setComparisonList([])
  
    try {
      const response = await fetch("http://127.0.0.1:5000/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
  
      if (!response.ok) throw new Error("Failed to fetch recommendations")
  
      const data = await response.json()
      console.log("Backend Response:", data)  // Debug log
  
      if (!data.recommendations || !Array.isArray(data.recommendations)) {
        throw new Error("Invalid response format: 'recommendations' missing or not an array")
      }
  
      const recommendationsWithScores = data.recommendations.map((rec: Recommendation, index: number) => ({
        ...rec,
        relevance_score:
          rec.relevance_score || ((data.recommendations.length - index) / data.recommendations.length) * 10,
      }))
  
      console.log("Processed Recommendations:", recommendationsWithScores)  // Debug log
  
      setRecommendations(recommendationsWithScores)
      setFilteredRecommendations(recommendationsWithScores)
      setStep(STEPS.RESULTS)
    } catch (err) {
      setError("An error occurred. Please try again.")
      console.error("Error in handleSubmit:", err)
    } finally {
      setLoading(false)
    }
  }
  // Reset the wizard
  const resetWizard = () => {
    setStep(STEPS.WELCOME)
    setQuery("")
    setRecommendations([])
    setFilteredRecommendations([])
    setExpandedCards({})
    setComparisonList([])
    setActiveTab("all")
    setSortBy("relevance")
    setFilterJobLevel("all")
    setSearchQuery("")
  }

  // Render relevance stars
  const renderStars = (score = 0) => {
    const stars = []
    const fullStars = Math.round(score / 2)

    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star key={i} className={`h-4 w-4 ${i < fullStars ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />,
      )
    }

    return (
      <div className="flex items-center gap-1">
        {stars}
        <span className="text-sm text-gray-500 ml-1">({score.toFixed(1)})</span>
      </div>
    )
  }

  // Render the welcome step
  const renderWelcomeStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      <div className="mb-8">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-purple-100 text-purple-600">
            <Sparkles className="h-12 w-12" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">Find Your Perfect Assessment</h1>
        <p className="text-gray-600 max-w-md mx-auto">
          Describe your hiring needs and we&apos;ll recommend the best SHL assessments for your candidates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="mb-4 mx-auto bg-blue-100 text-blue-600 p-3 rounded-full w-12 h-12 flex items-center justify-center">
              <Lightbulb className="h-6 w-6" />
            </div>
            <h3 className="font-medium mb-2">Personalized Recommendations</h3>
            <p className="text-sm text-gray-500">
              Get tailored assessment suggestions based on your specific requirements.
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="mb-4 mx-auto bg-green-100 text-green-600 p-3 rounded-full w-12 h-12 flex items-center justify-center">
              <Scale className="h-6 w-6" />
            </div>
            <h3 className="font-medium mb-2">Compare Options</h3>
            <p className="text-sm text-gray-500">
              Easily compare different assessments side by side to make the best choice.
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="mb-4 mx-auto bg-amber-100 text-amber-600 p-3 rounded-full w-12 h-12 flex items-center justify-center">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="font-medium mb-2">Quick Setup</h3>
            <p className="text-sm text-gray-500">Find and implement the right assessments in minutes, not hours.</p>
          </CardContent>
        </Card>
      </div>

      <Button size="lg" onClick={() => setStep(STEPS.QUERY)} className="bg-purple-600 hover:bg-purple-700">
        Get Started
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </motion.div>
  )

  // Render the query step
  const renderQueryStep = () => (
    <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Describe Your Hiring Needs</h2>
        <p className="text-gray-600">
          Tell us what you&apos;re looking for in candidates and we&apos;ll find the right assessments.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label htmlFor="query" className="text-base">
            What skills, qualities, or job roles are you hiring for?
          </Label>
          <div className="mt-2">
            <Input
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Java developers who collaborate well, Project managers with leadership skills"
              className="w-full"
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Be specific about technical skills, soft skills, and job requirements to get the most relevant
            recommendations.
          </p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="flex items-start gap-3">
            <div className="bg-purple-100 text-purple-600 p-2 rounded-full mt-1">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-medium text-purple-800 mb-1">Query Tips</h4>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• Include specific technical skills (e.g., &quot;Java&quot;, &quot;Python&quot;, &quot;data analysis&quot;)</li>
                <li>• Mention soft skills (e.g., &quot;teamwork&quot;, &quot;communication&quot;, &quot;leadership&quot;)</li>
                <li>• Specify job levels if relevant (e.g., &quot;entry-level&quot;, &quot;senior&quot;, &quot;executive&quot;)</li>
                <li>• Include industry context if applicable (e.g., &quot;for financial services&quot;, &quot;in healthcare&quot;)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={() => setStep(STEPS.WELCOME)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Finding Assessments...
            </>
          ) : (
            <>
              Get Recommendations
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )

  // Render the results step
  const renderResultsStep = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Recommended Assessments</h2>
          <p className="text-gray-600">
            Based on your query: <span className="font-medium italic">&quot;{query}&quot;</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetWizard}>
            New Search
          </Button>

          {comparisonList.length > 1 && (
            <Button
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {showComparison ? "Hide Comparison" : "Compare Selected"}
            </Button>
          )}
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assessments..."
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Assessment Type" />
            </SelectTrigger>
            <SelectContent>
              {testTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type === "all" ? "All Types" : type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="duration">Duration</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comparison view */}
      {showComparison && comparisonList.length > 1 && (
        <Card className="overflow-x-auto">
          <CardHeader>
            <CardTitle>Assessment Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="min-w-[800px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Feature</th>
                    {comparisonList.map((index) => {
                      const rec = recommendations[index]
                      return rec ? (
                        <th key={index} className="text-left py-2 px-4">
                          {rec.name}
                        </th>
                      ) : null
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium">Type</td>
                    {comparisonList.map((index) => {
                      const rec = recommendations[index]
                      return rec ? (
                        <td key={index} className="py-2 px-4">
                          {rec.test_type}
                        </td>
                      ) : null
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium">Duration</td>
                    {comparisonList.map((index) => {
                      const rec = recommendations[index]
                      return rec ? (
                        <td key={index} className="py-2 px-4">
                          {rec.duration}
                        </td>
                      ) : null
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium">Job Levels</td>
                    {comparisonList.map((index) => {
                      const rec = recommendations[index]
                      return rec ? (
                        <td key={index} className="py-2 px-4">
                          {rec.job_levels}
                        </td>
                      ) : null
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-4 font-medium">Languages</td>
                    {comparisonList.map((index) => {
                      const rec = recommendations[index]
                      return rec ? (
                        <td key={index} className="py-2 px-4">
                          {rec.languages}
                        </td>
                      ) : null
                    })}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium">Relevance Score</td>
                    {comparisonList.map((index) => {
                      const rec = recommendations[index]
                      return rec ? (
                        <td key={index} className="py-2 px-4">
                          {renderStars(rec.relevance_score || 0)}
                        </td>
                      ) : null
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results grid/list */}
      {filteredRecommendations.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRecommendations.map((rec, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card
                className={`overflow-hidden transition-all duration-200 ${comparisonList.includes(index) ? "border-purple-400 shadow-md" : ""}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{rec.name}</CardTitle>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => toggleFavorite(index)}
                              >
                                {favorites.includes(index) ? (
                                  <Bookmark className="h-4 w-4 text-purple-600 fill-purple-600" />
                                ) : (
                                  <BookmarkPlus className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {favorites.includes(index) ? "Remove from favorites" : "Add to favorites"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {rec.test_type}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {rec.duration}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {rec.job_levels.split(", ")[0]}
                          {rec.job_levels.split(", ").length > 1 ? "+" : ""}
                        </Badge>
                      </div>
                    </div>
                    {renderStars(rec.relevance_score || 0)}
                  </div>
                </CardHeader>

                <CardContent className="pb-2">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-500">Why Recommended</p>
                    <p className="text-sm">{rec.explanation}</p>
                  </div>

                  <AnimatePresence>
                    {expandedCards[index] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-500">Description</p>
                          <p className="text-sm">{rec.description}</p>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">Languages</p>
                            <p className="text-sm">{rec.languages}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Job Levels</p>
                            <p className="text-sm">{rec.job_levels}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>

                <CardFooter className="flex justify-between pt-2">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => toggleCard(index)} className="text-gray-500">
                      {expandedCards[index] ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          More
                        </>
                      )}
                    </Button>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={comparisonList.includes(index) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleComparison(index)}
                            className={comparisonList.includes(index) ? "bg-purple-600 hover:bg-purple-700" : ""}
                          >
                            {comparisonList.includes(index) ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Selected
                              </>
                            ) : (
                              "Compare"
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {comparisonList.includes(index) ? "Remove from comparison" : "Add to comparison"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <Button variant="outline" size="sm" asChild>
                    <a href={rec.url} target="_blank" rel="noopener noreferrer" className="flex items-center">
                      Learn More
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-gray-50 rounded-lg">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-1">No assessments found</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("")
              setActiveTab("all")
              setFilterJobLevel("all")
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </motion.div>
  )

  // Render progress steps
  const renderProgressSteps = () => {
    const steps = [
      { name: "Query", step: STEPS.QUERY },
      { name: "Results", step: STEPS.RESULTS },
    ]

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.name} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step >= s.step ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > s.step ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
              </div>

              {!isMobile && (
                <span className={`ml-2 ${step >= s.step ? "text-purple-600 font-medium" : "text-gray-500"}`}>
                  {s.name}
                </span>
              )}

              {i < steps.length - 1 && (
                <div className={`hidden md:block w-12 h-1 mx-2 ${step > s.step ? "bg-purple-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <Progress value={(step / (Object.keys(STEPS).length - 1)) * 100} className="h-2 mt-4 md:hidden bg-gray-200" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className={step === STEPS.WELCOME ? "pb-0" : ""}>
          {step !== STEPS.WELCOME && (
            <>
              <CardTitle className="text-2xl font-bold text-purple-700">SHL Assessment Recommender</CardTitle>
              {renderProgressSteps()}
            </>
          )}
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {step === STEPS.WELCOME && renderWelcomeStep()}
            {step === STEPS.QUERY && renderQueryStep()}
            {step === STEPS.RESULTS && renderResultsStep()}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}

