import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DemographicsDocument = HydratedDocument<Demographics>;

@Schema({ collection: 'user_demographics' })
export class Demographics {
  @Prop({ required: true })
  user_id!: string;

  @Prop({ required: true })
  last_ip!: string;

  @Prop({
    type: { country: String, city: String },
    _id: false,
  })
  location?: { country: string; city: string };

  @Prop({ default: Date.now })
  created_at!: Date;
}

export const DemographicsSchema = SchemaFactory.createForClass(Demographics);
