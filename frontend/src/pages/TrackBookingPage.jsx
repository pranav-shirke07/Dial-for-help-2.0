import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { publicApi } from "@/services/api";

const statusTone = {
  pending: "bg-amber-100 text-amber-700",
  assigned: "bg-sky-100 text-sky-700",
  completed: "bg-green-100 text-green-700",
};

export default function TrackBookingPage() {
  const [bookingId, setBookingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const searchBooking = async () => {
    if (!bookingId.trim()) {
      toast.error("Please enter a booking ID.");
      return;
    }

    setLoading(true);
    try {
      const data = await publicApi.trackBooking(bookingId.trim());
      setResult(data);
      toast.success("Booking found.");
    } catch {
      setResult(null);
      toast.error("Booking ID not found.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8" data-testid="track-booking-page">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Track My Booking</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl leading-tight">Check your service status instantly.</h1>
        <p className="text-sm md:text-lg text-muted-foreground" data-testid="track-booking-subtitle">
          Enter the booking ID received after booking confirmation.
        </p>
      </div>

      <Card className="rounded-3xl border-stone-200 bg-white/95">
        <CardHeader>
          <CardTitle data-testid="track-booking-form-title">Booking Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="track_booking_id">Booking ID</Label>
            <Input
              id="track_booking_id"
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
              data-testid="track-booking-id-input"
            />
          </div>
          <Button type="button" onClick={searchBooking} disabled={loading} data-testid="track-booking-search-button">
            {loading ? "Checking..." : "Track Booking"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-3xl border-stone-200 bg-white" data-testid="track-booking-result-card">
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm" data-testid="track-booking-result-id">
                {result.booking_id}
              </p>
              <Badge className={statusTone[result.status]} data-testid="track-booking-result-status">
                {result.status}
              </Badge>
            </div>
            <p data-testid="track-booking-result-service">Service: {result.service_type}</p>
            <p data-testid="track-booking-result-customer">Customer: {result.customer_name}</p>
            <p data-testid="track-booking-result-date">Preferred Date: {result.preferred_date}</p>
            <p data-testid="track-booking-result-charge">Plan: {result.charge_type}</p>
            <p data-testid="track-booking-result-worker">
              Assigned Worker: {result.assigned_worker_name || "Not assigned yet"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
