import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { JobStatus } from './jobStatus.enum';

export type JobDocument = Job & Document;



@Schema()
export class Job {
  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  client: User;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  worker: User;

  @Prop({ required: true, enum: JobStatus, default: ["In Progress"] })
  status: JobStatus;

  @Prop()
  clientReview: number;
}

export const JobSchema = SchemaFactory.createForClass(Job);
