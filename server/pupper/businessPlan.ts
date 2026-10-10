import { z } from 'zod'
export const BusinessPlanSchema=z.object({
 executiveSummary:z.string().min(30).max(4000),
 targetCustomer:z.string().min(30).max(4000),
 marketAnalysis:z.string().min(30).max(4000),
 competitorAnalysis:z.string().min(30).max(4000),
 whyThisCouldEarn:z.string().min(30).max(4000),
 confidenceAndEvidence:z.string().min(30).max(4000),
 revenueModel:z.string().min(20).max(4000),
 pricingHypothesis:z.string().min(20).max(4000),
 differentiation:z.string().min(20).max(4000),
 acquisition:z.string().min(20).max(4000),
 costs:z.string().min(20).max(4000),
 unitEconomics:z.string().min(30).max(4000),
 revenueScenarios:z.string().min(30).max(4000),
 launchPlan:z.string().min(30).max(4000),
 risks:z.string().min(20).max(4000),
 stopConditions:z.string().min(30).max(4000)
})
export const businessPlanInstructions=`Keep the complete response below 2200 words. Write a detailed English investment-style business plan using every field of the supplied schema. Explicitly distinguish OBSERVED FACTS from ASSUMPTIONS and UNKNOWN information. Cite only supplied observed sources; never invent market sizes, customer interviews, conversion rates, willingness to pay, signed customers or revenue. Explain precisely why someone might pay and why existing alternatives fail this specific buyer. Compare observed competitors by pricing, workflows and limitations; disclose missing original-source evidence. Describe buyer, budget owner, recurring trigger, reachable initial segment, positioning, acquisition experiment and launch milestones. confidenceAndEvidence must state LOW, MEDIUM or HIGH evidence confidence, evidence supporting each reason, evidence against it, remaining unknowns and the experiment needed to raise confidence. It is confidence in the evidence, not a calibrated probability of profit. unitEconomics must show explicit assumed price, variable cost, contribution per paying customer, fixed monthly costs and break-even formula; do not assert unsupported lifetime value. revenueScenarios must include conservative, base and optimistic illustrative scenarios with all numerical assumptions, paying customer count, gross revenue, costs and operating result; show arithmetic and label them scenarios rather than forecasts. Include the zero-paying-customer downside. Account for implementation scope: prototype capabilities are not production capabilities, and missing hosting, persistence, accounts, integrations and payments add costs and risk. Give concrete stopConditions, rejection evidence, and paid-pilot validation criteria. Never guarantee that the product will earn money. If sources are insufficient, say so and prescribe specific research instead of presenting guesses as a complete market study.`
