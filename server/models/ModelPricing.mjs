import mongoose from 'mongoose'

const modelPricingSchema = new mongoose.Schema(
  {
    model: { type: String, required: true, index: true },
    inputPerMillionUsd: { type: Number, required: true },
    outputPerMillionUsd: { type: Number, required: true },
    cachedPerMillionUsd: { type: Number, default: 0 },
    effectiveFrom: { type: Date, required: true, index: true },
  },
  { timestamps: true, collection: 'model_pricing' },
)

modelPricingSchema.index({ model: 1, effectiveFrom: -1 })

export const ModelPricing = mongoose.model('ModelPricing', modelPricingSchema)
