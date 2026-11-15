
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"changed_fields": (string)[] | null,"created_at": string,"group_id": string | null,"id": number,"new_data": Json | null,"old_data": Json | null,"owner_id": string | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"changed_fields"?: (string)[] | null,"created_at"?: string,"group_id"?: string | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"owner_id"?: string | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"changed_fields"?: (string)[] | null,"created_at"?: string,"group_id"?: string | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"owner_id"?: string | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "archived_at": string | null,"color": string,"created_at": string,"group_id": string | null,"icon": string,"id": string,"is_system": boolean,"name": string,"owner_id": string | null,"parent_id": string | null,"slug": string | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"group_id"?: string | null,"icon"?: string,"id"?: string,"is_system"?: boolean,"name": string,"owner_id"?: string | null,"parent_id"?: string | null,"slug"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"group_id"?: string | null,"icon"?: string,"id"?: string,"is_system"?: boolean,"name"?: string,"owner_id"?: string | null,"parent_id"?: string | null,"slug"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_attachments": {
                  Row: {
                    "created_at": string,"created_by": string,"expense_id": string,"file_name": string,"id": string,"kind": string,"mime_type": string,"size_bytes": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"expense_id": string,"file_name": string,"id"?: string,"kind"?: string,"mime_type": string,"size_bytes": number,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expense_id"?: string,"file_name"?: string,"id"?: string,"kind"?: string,"mime_type"?: string,"size_bytes"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_attachments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_attachments_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_attachments_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "v_expenses"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"category_id": string,"created_at": string,"created_by": string,"currency": string,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"expense_date": string,"group_id": string | null,"id": string,"merchant": string | null,"notes": string | null,"paid_by": string,"payment_method": string,"scope": string,"settlement_id": string | null,"source": string,"source_metadata": Json | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category_id": string,"created_at"?: string,"created_by"?: string,"currency": string,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"expense_date"?: string,"group_id"?: string | null,"id"?: string,"merchant"?: string | null,"notes"?: string | null,"paid_by"?: string,"payment_method"?: string,"scope"?: string,"settlement_id"?: string | null,"source"?: string,"source_metadata"?: Json | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"category_id"?: string,"created_at"?: string,"created_by"?: string,"currency"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"expense_date"?: string,"group_id"?: string | null,"id"?: string,"merchant"?: string | null,"notes"?: string | null,"paid_by"?: string,"payment_method"?: string,"scope"?: string,"settlement_id"?: string | null,"source"?: string,"source_metadata"?: Json | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_settlement_id_fkey"
      columns: ["settlement_id"]
isOneToOne: false
      referencedRelation: "settlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_invitations": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"group_id": string,"id": string,"max_uses": number,"revoked_at": string | null,"token": string,"used_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"group_id": string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"token"?: string,"used_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"group_id"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"token"?: string,"used_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_invitations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_invitations_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "group_id": string,"invited_by": string | null,"joined_at": string,"left_at": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"invited_by"?: string | null,"joined_at"?: string,"left_at"?: string | null,"role"?: string,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"invited_by"?: string | null,"joined_at"?: string,"left_at"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "archived_at": string | null,"close_hold": boolean,"closing_day": number | null,"closing_type": string,"color": string,"created_at": string,"created_by": string,"currency": string,"description": string | null,"icon": string,"id": string,"name": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"close_hold"?: boolean,"closing_day"?: number | null,"closing_type"?: string,"color"?: string,"created_at"?: string,"created_by"?: string,"currency"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"name": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"close_hold"?: boolean,"closing_day"?: number | null,"closing_type"?: string,"color"?: string,"created_at"?: string,"created_by"?: string,"currency"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"name"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"currency": string,"default_group_id": string | null,"default_payment_method": string,"default_scope": string,"display_name": string,"email": string,"id": string,"locale": string,"onboarded_at": string | null,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"currency"?: string,"default_group_id"?: string | null,"default_payment_method"?: string,"default_scope"?: string,"display_name"?: string,"email"?: string,"id": string,"locale"?: string,"onboarded_at"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"currency"?: string,"default_group_id"?: string | null,"default_payment_method"?: string,"default_scope"?: string,"display_name"?: string,"email"?: string,"id"?: string,"locale"?: string,"onboarded_at"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_default_group_fk"
      columns: ["default_group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"settlement_balances": {
                  Row: {
                    "balance": number,"paid": number,"settlement_id": string,"share": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "balance": number,"paid": number,"settlement_id": string,"share": number,"user_id": string
                  }
                  Update: {
                    "balance"?: number,"paid"?: number,"settlement_id"?: string,"share"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlement_balances_settlement_id_fkey"
      columns: ["settlement_id"]
isOneToOne: false
      referencedRelation: "settlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlement_balances_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"settlement_transfers": {
                  Row: {
                    "amount": number,"from_user": string,"id": string,"marked_by": string | null,"paid_at": string | null,"settlement_id": string,"to_user": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"from_user": string,"id"?: string,"marked_by"?: string | null,"paid_at"?: string | null,"settlement_id": string,"to_user": string
                  }
                  Update: {
                    "amount"?: number,"from_user"?: string,"id"?: string,"marked_by"?: string | null,"paid_at"?: string | null,"settlement_id"?: string,"to_user"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlement_transfers_from_user_fkey"
      columns: ["from_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlement_transfers_marked_by_fkey"
      columns: ["marked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlement_transfers_settlement_id_fkey"
      columns: ["settlement_id"]
isOneToOne: false
      referencedRelation: "settlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlement_transfers_to_user_fkey"
      columns: ["to_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"settlements": {
                  Row: {
                    "closed_at": string,"closed_by": string | null,"closing_day": number | null,"closing_type": string,"currency": string,"group_id": string,"id": string,"member_count": number,"period_end": string,"period_start": string,"reopened_at": string | null,"reopened_by": string | null,"status": string,"total_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string,"closed_by"?: string | null,"closing_day"?: number | null,"closing_type": string,"currency": string,"group_id": string,"id"?: string,"member_count"?: number,"period_end": string,"period_start": string,"reopened_at"?: string | null,"reopened_by"?: string | null,"status"?: string,"total_amount"?: number
                  }
                  Update: {
                    "closed_at"?: string,"closed_by"?: string | null,"closing_day"?: number | null,"closing_type"?: string,"currency"?: string,"group_id"?: string,"id"?: string,"member_count"?: number,"period_end"?: string,"period_start"?: string,"reopened_at"?: string | null,"reopened_by"?: string | null,"status"?: string,"total_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlements_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_reopened_by_fkey"
      columns: ["reopened_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_expenses": {
                  Row: {
                    "amount": number,"category_color": string | null,"category_icon": string | null,"category_id": string,"category_name": string | null,"created_at": string,"created_by": string,"currency": string,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"expense_date": string,"group_id": string | null,"group_name": string | null,"id": string,"is_locked": boolean | null,"merchant": string | null,"notes": string | null,"paid_by": string,"paid_by_avatar_url": string | null,"paid_by_name": string | null,"payment_method": string,"root_category_color": string | null,"root_category_icon": string | null,"root_category_id": string | null,"root_category_name": string | null,"scope": string,"settlement_id": string | null,"share_amount": number | null,"source": string,"split_count": number | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "expenses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_settlement_id_fkey"
      columns: ["settlement_id"]
isOneToOne: false
      referencedRelation: "settlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_group_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"close_due_periods":
{ Args: { "p_group_id": string,"p_release_hold"?: boolean }; Returns: number
                           },
"dashboard_by_category":
{ Args: { "p_from": string,"p_full_amount"?: boolean,"p_group_id"?: string,"p_level"?: string,"p_scope"?: string,"p_to": string }; Returns: {
              "category_id": string,"color": string,"currency": string,"icon": string,"name": string,"total": number,"tx_count": number
            }[]
                           },
"dashboard_by_month":
{ Args: { "p_from": string,"p_full_amount"?: boolean,"p_group_id"?: string,"p_scope"?: string,"p_to": string }; Returns: {
              "currency": string,"month": string,"total": number,"tx_count": number
            }[]
                           },
"get_group_balance":
{ Args: { "p_group_id": string }; Returns: Json
                           },
"get_invitation_preview":
{ Args: { "p_token": string }; Returns: Json
                           },
"leave_group":
{ Args: { "p_group_id": string }; Returns: undefined
                           },
"mark_transfer_paid":
{ Args: { "p_paid"?: boolean,"p_transfer_id": string }; Returns: undefined
                           },
"reopen_last_period":
{ Args: { "p_group_id": string }; Returns: string
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
