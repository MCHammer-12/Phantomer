import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EventFormData } from "@/types";
import type { Section } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { createEvent, refreshEvent } from "@/services/api";
import { queryClient } from "@/lib/queryClient";
import { ChipInput, NumberChipInput, TagChipInput } from "./ChipInput";
import { useState } from "react";

// Form schema with single-select fields
const formSchema = z.object({
  eventName: z.string().min(1, "Event name is required"),
  eventUrl: z.string().url("Must be a valid URL"),
  row: z.string().min(1, "Row is required"),
  section: z.enum(["Left", "Center", "Right"], {
    required_error: "Section is required",
    invalid_type_error: "Section must be Left, Center, or Right",
  }),
  price: z.coerce
    .number()
    .positive("Price must be a positive number")
    .min(0.01, "Price must be at least 0.01"),
  groupSize: z.coerce
    .number()
    .int("Group size must be a whole number")
    .positive("Group size must be a positive number")
    .min(1, "Group size must be at least 1"),
  tag: z.string().optional(),
});

interface EventFormProps {
  onSuccess?: () => void;
}

export default function EventForm({ onSuccess }: EventFormProps) {
  const { toast } = useToast();
  const [urlError, setUrlError] = useState<string | null>(null);
  const [availableTags] = useState(["VIP", "Premium", "General", "Discount", "Limited"]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eventName: "",
      eventUrl: "",
      row: "",
      section: "Left" as Section,
      price: undefined,
      groupSize: undefined,
      tag: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: EventFormData) => createEvent(data),
    onSuccess: async (createdEvent) => {
      // Fetch XML for the newly added event
      await refreshEvent(createdEvent.id);
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Event Added",
        description: "Your event has been added to monitoring",
        variant: "default",
      });
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add event: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setUrlError(null);
    const urlPattern = /^https:\/\/my\.arttix\.org\/api\/syos\/GetSeatList\?performanceId=\d+&facilityId=\d+&screenId=\d+$/;
    if (!urlPattern.test(values.eventUrl)) {
      setUrlError(
        "Invalid URL – must be: https://my.arttix.org/api/syos/GetSeatList?performanceId=<id>&facilityId=<id>&screenId=<id>"
      );
      return;
    }
    mutation.mutate(values);
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 w-[300px] flex-shrink-0">
      <h2 className="text-lg font-semibold mb-4 dark:text-white">Add New Event</h2>
      {urlError && (
        <div className="text-red-500 text-sm mb-2">
          {urlError}
        </div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="eventName"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Enter event name"
                    className="bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 border-gray-300 dark:border-gray-600"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="dark:text-red-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="eventUrl"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Event URL"
                    type="url"
                    className="bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 border-gray-300 dark:border-gray-600"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="dark:text-red-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="row"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Row (e.g., A, B, C)"
                    className="bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 border-gray-300 dark:border-gray-600"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="dark:text-red-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="section"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ChipInput
                    options={["Left", "Center", "Right"]}
                    selectedValue={field.value}
                    onChange={field.onChange}
                    placeholder="Select section"
                  />
                </FormControl>
                <FormMessage className="dark:text-red-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Maximum price"
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 border-gray-300 dark:border-gray-600"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="dark:text-red-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="groupSize"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <NumberChipInput
                    min={1}
                    max={8}
                    selectedValue={field.value ?? null}
                    onChange={field.onChange}
                    placeholder="Select group size"
                  />
                </FormControl>
                <FormMessage className="dark:text-red-400" />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="tag"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ChipInput
                    options={availableTags}
                    selectedValue={field.value ?? null}
                    onChange={field.onChange}
                    placeholder="Select a tag (optional)"
                  />
                </FormControl>
                <FormMessage className="dark:text-red-400" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium dark:bg-blue-700 dark:hover:bg-blue-600"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Adding..." : "Add Event to Monitor"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
