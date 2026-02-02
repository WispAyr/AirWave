'use client'

import { useState } from 'react'
import { Camera, RefreshCw, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface Photo {
  id: number
  aircraft_tail: string
  photo_url: string
  thumbnail_url?: string
  photographer?: string
  upload_date?: string
  source?: string
  aircraft_type?: string
  fetched_at: string
}

interface AircraftPhotoGalleryProps {
  aircraftId: string
  photos: Photo[]
  loading?: boolean
  onRefresh?: () => void
}

export default function AircraftPhotoGallery({
  aircraftId,
  photos,
  loading = false,
  onRefresh
}: AircraftPhotoGalleryProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const [imageLoading, setImageLoading] = useState<Set<number>>(new Set())

  const handleImageError = (photoId: number) => {
    setImageErrors(prev => new Set([...prev, photoId]))
    setImageLoading(prev => {
      const next = new Set(prev)
      next.delete(photoId)
      return next
    })
  }

  const handleImageLoad = (photoId: number) => {
    setImageLoading(prev => {
      const next = new Set(prev)
      next.delete(photoId)
      return next
    })
  }

  const handleImageLoadStart = (photoId: number) => {
    setImageLoading(prev => new Set([...prev, photoId]))
  }

  const openLightbox = (index: number) => {
    setSelectedPhotoIndex(index)
  }

  const closeLightbox = () => {
    setSelectedPhotoIndex(null)
  }

  const nextPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1)
    }
  }

  const prevPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeLightbox()
    } else if (e.key === 'ArrowRight') {
      nextPhoto()
    } else if (e.key === 'ArrowLeft') {
      prevPhoto()
    }
  }

  const selectedPhoto = selectedPhotoIndex !== null ? photos[selectedPhotoIndex] : null

  return (
    <div className="data-card rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-spacex-accent font-mono flex items-center">
          <Camera className="w-5 h-5 mr-2" />
          AIRCRAFT PHOTOS
          {photos.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-spacex-accent/20 text-spacex-accent text-xs rounded">
              {photos.length}
            </span>
          )}
        </h3>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-1.5 bg-spacex-accent/10 hover:bg-spacex-accent/20 text-spacex-accent border border-spacex-accent/30 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && photos.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-3 text-spacex-accent animate-spin" />
            <p className="font-mono text-sm text-gray-500">Loading photos...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && photos.length === 0 && (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm mb-2">No photos available</p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-2 text-spacex-accent hover:text-spacex-green text-xs font-mono underline"
              >
                Try fetching photos
              </button>
            )}
          </div>
        </div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="relative group cursor-pointer overflow-hidden rounded-lg border border-spacex-gray/30 bg-spacex-darker/50 hover:border-spacex-accent/50 transition-all"
              onClick={() => openLightbox(index)}
            >
              {/* Image Container */}
              <div className="aspect-video relative bg-spacex-dark">
                {imageLoading.has(photo.id) && !imageErrors.has(photo.id) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-spacex-accent animate-spin" />
                  </div>
                )}
                
                {imageErrors.has(photo.id) ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-gray-600" />
                  </div>
                ) : (
                  <img
                    src={photo.thumbnail_url || photo.photo_url}
                    alt={`Aircraft photo by ${photo.photographer || 'Unknown'}`}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(photo.id)}
                    onLoad={() => handleImageLoad(photo.id)}
                    onLoadStart={() => handleImageLoadStart(photo.id)}
                  />
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <div className="text-white text-xs font-mono">
                    Click to view full size
                  </div>
                </div>
              </div>

              {/* Photo Info */}
              <div className="p-3 space-y-1">
                {photo.photographer && (
                  <div className="text-xs font-mono text-gray-400">
                    📷 {photo.photographer}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs font-mono">
                  {photo.source && (
                    <span className={`px-2 py-0.5 rounded ${
                      photo.source === 'JetPhotos' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {photo.source}
                    </span>
                  )}
                  
                  {photo.upload_date && (
                    <span className="text-gray-500">
                      {format(new Date(photo.upload_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 bg-spacex-dark/80 hover:bg-spacex-dark text-white rounded-lg transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation Buttons */}
          {selectedPhotoIndex !== null && selectedPhotoIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                prevPhoto()
              }}
              className="absolute left-4 p-3 bg-spacex-dark/80 hover:bg-spacex-dark text-white rounded-lg transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                nextPhoto()
              }}
              className="absolute right-4 p-3 bg-spacex-dark/80 hover:bg-spacex-dark text-white rounded-lg transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <div className="max-w-6xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedPhoto.photo_url}
              alt={`Aircraft photo by ${selectedPhoto.photographer || 'Unknown'}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            
            {/* Photo Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 rounded-b-lg">
              <div className="space-y-2">
                {selectedPhoto.photographer && (
                  <div className="text-white font-mono text-sm">
                    📷 Photographer: {selectedPhoto.photographer}
                  </div>
                )}
                
                <div className="flex items-center space-x-4 text-xs font-mono text-gray-300">
                  {selectedPhoto.source && (
                    <span className={`px-2 py-1 rounded ${
                      selectedPhoto.source === 'JetPhotos' 
                        ? 'bg-blue-500/30 text-blue-300' 
                        : 'bg-green-500/30 text-green-300'
                    }`}>
                      {selectedPhoto.source}
                    </span>
                  )}
                  
                  {selectedPhoto.upload_date && (
                    <span>
                      Uploaded: {format(new Date(selectedPhoto.upload_date), 'MMMM d, yyyy')}
                    </span>
                  )}
                  
                  {selectedPhoto.aircraft_type && (
                    <span>
                      Type: {selectedPhoto.aircraft_type}
                    </span>
                  )}
                </div>
                
                <div className="text-gray-400 text-xs font-mono">
                  Photo {selectedPhotoIndex! + 1} of {photos.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

