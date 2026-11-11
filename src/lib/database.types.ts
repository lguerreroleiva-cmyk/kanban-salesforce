// Tipos de la base de datos en el formato de `supabase gen types typescript`.
// Regenerar tras aplicar migraciones:  npm run gen:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          app_role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          app_role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          app_role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      boards: {
        Row: { id: string; name: string; owner_id: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; owner_id?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; owner_id?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      board_members: {
        Row: { board_id: string; user_id: string; role: string; created_at: string };
        Insert: { board_id: string; user_id: string; role?: string; created_at?: string };
        Update: { board_id?: string; user_id?: string; role?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: 'board_members_board_id_fkey';
            columns: ['board_id'];
            isOneToOne: false;
            referencedRelation: 'boards';
            referencedColumns: ['id'];
          },
        ];
      };
      board_columns: {
        Row: { id: string; board_id: string; name: string; position: number; created_at: string };
        Insert: { id?: string; board_id: string; name: string; position?: number; created_at?: string };
        Update: { id?: string; board_id?: string; name?: string; position?: number; created_at?: string };
        Relationships: [
          {
            foreignKeyName: 'board_columns_board_id_fkey';
            columns: ['board_id'];
            isOneToOne: false;
            referencedRelation: 'boards';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          board_id: string;
          column_id: string;
          title: string;
          description: string;
          position: number;
          assignee_id: string | null;
          due_date: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          column_id: string;
          title: string;
          description?: string;
          position?: number;
          assignee_id?: string | null;
          due_date?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          board_id?: string;
          column_id?: string;
          title?: string;
          description?: string;
          position?: number;
          assignee_id?: string | null;
          due_date?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_board_id_fkey';
            columns: ['board_id'];
            isOneToOne: false;
            referencedRelation: 'boards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_column_fk';
            columns: ['column_id', 'board_id'];
            isOneToOne: false;
            referencedRelation: 'board_columns';
            referencedColumns: ['id', 'board_id'];
          },
        ];
      };
      task_history: {
        Row: {
          id: number;
          task_id: string;
          actor_id: string | null;
          entity: string;
          entity_id: string | null;
          action: string;
          summary: string | null;
          changes: Json;
          snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          task_id: string;
          actor_id?: string | null;
          entity?: string;
          entity_id?: string | null;
          action: string;
          summary?: string | null;
          changes?: Json;
          snapshot?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          task_id?: string;
          actor_id?: string | null;
          entity?: string;
          entity_id?: string | null;
          action?: string;
          summary?: string | null;
          changes?: Json;
          snapshot?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_history_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      component_types: {
        Row: {
          id: string;
          name: string;
          metadata_type: string | null;
          requires_note: boolean;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          metadata_type?: string | null;
          requires_note?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          metadata_type?: string | null;
          requires_note?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_components: {
        Row: {
          id: string;
          task_id: string;
          component_type_id: string;
          component_name: string;
          other_type_note: string | null;
          intervention_type: string;
          work_detail: string;
          work_detail_plain: string;
          sort_order: number;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          component_type_id: string;
          component_name: string;
          other_type_note?: string | null;
          intervention_type: string;
          work_detail: string;
          work_detail_plain?: string;
          sort_order?: number;
          created_by?: string;
          updated_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          component_type_id?: string;
          component_name?: string;
          other_type_note?: string | null;
          intervention_type?: string;
          work_detail?: string;
          work_detail_plain?: string;
          sort_order?: number;
          created_by?: string;
          updated_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_components_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_components_component_type_id_fkey';
            columns: ['component_type_id'];
            isOneToOne: false;
            referencedRelation: 'component_types';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_task: { Args: { p_task_id: string }; Returns: boolean };
      html_is_unsafe: { Args: { p_html: string }; Returns: boolean };
      html_to_plain: { Args: { p_html: string }; Returns: string };
      is_app_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_board_member: { Args: { p_board_id: string }; Returns: boolean };
      is_board_owner: { Args: { p_board_id: string }; Returns: boolean };
      search_task_components: {
        Args: { p_query: string; p_limit?: number };
        Returns: {
          component_id: string;
          task_id: string;
          task_title: string;
          board_id: string;
          board_name: string;
          component_type_id: string;
          component_type_name: string;
          component_name: string;
          intervention_type: string;
          work_detail_plain: string;
          created_at: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
