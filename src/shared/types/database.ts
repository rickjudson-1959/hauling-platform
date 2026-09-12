// Generated from the live Supabase project (hauling-platform).
// After applying migrations, regenerate with:
//   npx supabase gen types typescript --project-id <your-project-id> \
//     > src/shared/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      customers: {
        Row: {
          billing_address: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
        }
        Insert: {
          billing_address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
        }
        Update: {
          billing_address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customers_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'orgs'
            referencedColumns: ['id']
          },
        ]
      }
      haul_types: {
        Row: {
          id: string
          name: string
          org_id: string
          unit: string
        }
        Insert: {
          id?: string
          name: string
          org_id: string
          unit: string
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: 'haul_types_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'orgs'
            referencedColumns: ['id']
          },
        ]
      }
      invoice_audit_log: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          invoice_id: string
          new_status: string | null
          note: string | null
          old_status: string | null
          org_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          new_status?: string | null
          note?: string | null
          old_status?: string | null
          org_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          new_status?: string | null
          note?: string | null
          old_status?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_audit_log_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          description: string
          id: string
          invoice_id: string
          job_id: string | null
          quantity: number | null
          unit: string | null
        }
        Insert: {
          amount?: number
          description: string
          id?: string
          invoice_id: string
          job_id?: string | null
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          invoice_id?: string
          job_id?: string | null
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_line_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoice_line_items_job_id_fkey'
            columns: ['job_id']
            isOneToOne: true
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number | null
          description: string | null
          id: string
          invoice_id: string
          job_id: string | null
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          amount?: number | null
          description?: string | null
          id?: string
          invoice_id: string
          job_id?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          amount?: number | null
          description?: string | null
          id?: string
          invoice_id?: string
          job_id?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_lines_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoice_lines_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
        ]
      }
      invoice_number_seq: {
        Row: {
          last_seq: number
          org_id: string
        }
        Insert: {
          last_seq?: number
          org_id: string
        }
        Update: {
          last_seq?: number
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_number_seq_org_id_fkey'
            columns: ['org_id']
            isOneToOne: true
            referencedRelation: 'orgs'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          notes: string | null
          org_id: string
          paid_at: string | null
          sent_at: string | null
          status: string
          subtotal: number | null
          total: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          notes?: string | null
          org_id: string
          paid_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'orgs'
            referencedColumns: ['id']
          },
        ]
      }
      jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          customer_id: string | null
          driver_id: string | null
          haul_type_id: string | null
          id: string
          notes: string | null
          org_id: string
          payment_status: string
          photo_url: string | null
          price: number | null
          quantity: number | null
          scheduled_for: string | null
          signature_url: string | null
          site_address: string | null
          status: string
          stripe_payment_intent_id: string | null
          tax_amount: number | null
          tax_label: string | null
          truck_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          driver_id?: string | null
          haul_type_id?: string | null
          id?: string
          notes?: string | null
          org_id: string
          payment_status?: string
          photo_url?: string | null
          price?: number | null
          quantity?: number | null
          scheduled_for?: string | null
          signature_url?: string | null
          site_address?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          tax_amount?: number | null
          tax_label?: string | null
          truck_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          driver_id?: string | null
          haul_type_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          payment_status?: string
          photo_url?: string | null
          price?: number | null
          quantity?: number | null
          scheduled_for?: string | null
          signature_url?: string | null
          site_address?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          tax_amount?: number | null
          tax_label?: string | null
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'jobs_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jobs_driver_id_fkey'
            columns: ['driver_id']
            isOneToOne: false
            referencedRelation: 'memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jobs_haul_type_id_fkey'
            columns: ['haul_type_id']
            isOneToOne: false
            referencedRelation: 'haul_types'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jobs_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'orgs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jobs_truck_id_fkey'
            columns: ['truck_id']
            isOneToOne: false
            referencedRelation: 'trucks'
            referencedColumns: ['id']
          },
        ]
      }
      memberships: {
        Row: {
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'orgs'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          job_id: string
          org_id: string
          receipt_emailed_at: string | null
          source: string
          status: string
          stripe_charge_id: string | null
          stripe_event_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          job_id: string
          org_id: string
          receipt_emailed_at?: string | null
          source?: string
          status: string
          stripe_charge_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          job_id?: string
          org_id?: string
          receipt_emailed_at?: string | null
          source?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'payments_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'orgs'
            referencedColumns: ['id']
          },
        ]
      }
      stripe_events: {
        Row: {
          created_at: string
          id: string
          job_id: string | null
          org_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          job_id?: string | null
          org_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          org_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stripe_events_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stripe_events_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'orgs'
            referencedColumns: ['id']
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      trucks: {
        Row: {
          capacity: number | null
          haul_type_id: string | null
          id: string
          label: string
          org_id: string
          status: string
        }
        Insert: {
          capacity?: number | null
          haul_type_id?: string | null
          id?: string
          label: string
          org_id: string
          status?: string
        }
        Update: {
          capacity?: number | null
          haul_type_id?: string | null
          id?: string
          label?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trucks_haul_type_id_fkey'
            columns: ['haul_type_id']
            isOneToOne: false
            referencedRelation: 'haul_types'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trucks_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'orgs'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_invoice: {
        Args: { p_customer_id: string; p_job_ids: string[]; p_notes?: string | null }
        Returns: string
      }
      my_membership_id: { Args: never; Returns: string }
      my_org_id: { Args: never; Returns: string }
      my_role: { Args: never; Returns: string }
      next_invoice_number: { Args: { p_org_id: string }; Returns: string }
      org_drivers: {
        Args: never
        Returns: {
          email: string
          membership_id: string
        }[]
      }
      org_members: {
        Args: never
        Returns: {
          email: string
          membership_id: string
          role: string
          user_id: string
        }[]
      }
      update_invoice_status: {
        Args: { p_invoice_id: string; p_new_status: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
