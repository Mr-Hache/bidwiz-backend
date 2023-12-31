import { Injectable, ConflictException, InternalServerErrorException, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'src/schemas/user.schema';
import { Model } from 'mongoose';
import { CreateUserDto } from 'src/dto/create-user.dto';
import { UpdateUserWizardDto } from 'src/dto/update-user-wizard.dto';

@Injectable()
export class UsersService {
    constructor (@InjectModel(User.name) private userModel: Model<User>){}
    
    async create(createUserDto: CreateUserDto): Promise<User> {
        if (!createUserDto.isWizard && (createUserDto.languages || createUserDto.subjects || createUserDto.experience)) {
            throw new BadRequestException('You cannot pass wizard-related fields when isWizard is false');
        }

        if (createUserDto.isWizard && (!createUserDto.experience || !createUserDto.experience.title || !createUserDto.experience.origin)) {
            throw new BadRequestException('You must provide experience title and origin when isWizard is true');
        }
        const createdUser = new this.userModel(createUserDto);
        
        try {
            return await createdUser.save();
        } catch (error) {
            if (error.code === 11000) {
                let errorMessage = 'Conflict error: mail already exists.'
                throw new ConflictException(errorMessage);
            }
                throw new InternalServerErrorException();
        }
    }
    
    async findAllWizards(subjects?: string[], languages?: string[], sortByReviews?: string, page = 1, size = 10): Promise<User[]> {
        let query = {
          isDisabled: false,
          role: { $ne: 'admin' },
          isWizard: true
        };
      
        let andConditions = [];
      
        if (subjects) {
          andConditions.push({ 'subjects': { $in: subjects } });
        }
      
        if (languages) {
          andConditions.push({ 'languages': { $in: languages } });
        }
      
        if(andConditions.length > 0) {
          query['$and'] = andConditions;
        }
     
        let queryResult = this.userModel.find(query, {  email: 0 })
          .skip((page - 1) * size)
          .limit(size)
          
            if (sortByReviews) {
                if (sortByReviews === 'asc') {
                queryResult = queryResult.sort({ reviews: 1 });
                } else if (sortByReviews === 'desc') {
                queryResult = queryResult.sort({ reviews: -1 });
                }
            }
        
            return queryResult.exec();
      }
      
      
    async countAllWizards(subjects?: string[], languages?: string[]): Promise<number> {
        
        let query = {
            isDisabled: false,
            role: { $ne: 'admin' },
            isWizard: true
          };
        
          let andConditions = [];
        
          if (subjects) {
            andConditions.push({ 'subjects': { $in: subjects } });
          }
        
          if (languages) {
            andConditions.push({ 'languages': { $in: languages } });
          }
        
          if(andConditions.length > 0) {
            query['$and'] = andConditions;
          }
       
          const count = await this.userModel.countDocuments(query).exec();
          return count;
    }  

    async findAllAdmin(): Promise<User[]> {
        return this.userModel.find({role: { $ne: 'admin' }}).exec();
    }

    async findAllEmails(): Promise<{ email: string; isDisabled: boolean }[]> {
        const users = await this.userModel.find({role: { $ne: 'admin' }}, {email: 1, isDisabled: 1, _id: 0}).exec();
        return users.map(user => ({ email: user.email, isDisabled: user.isDisabled }));
    }
    
    
    async findOneWizard(_id: string): Promise<User> {
        const user = await this.userModel.findOne({ _id: _id, isDisabled: false, role: { $ne: 'admin' },
        isWizard: true }).exec();
        if (!user) {
            throw new NotFoundException(`User with id ${_id} not found`);
        }
        return user;
    }

    async findOneUserUid(uidFireBase: string): Promise<User> {
        const user = await this.userModel.findOne({ uidFireBase: uidFireBase, isDisabled: false }).exec();
        if (!user) {
            throw new NotFoundException(`User with uid ${uidFireBase} not found`);
        }
        return user;
    }
    

    
    async updateWizard(_id: string, updateUserWizardDto: UpdateUserWizardDto): Promise<User> {
        const user = await this.userModel.findOne({ _id: _id, isDisabled: false }).exec();
        if (!user) {
            throw new NotFoundException(`User with id ${_id} not found`);
        }

        if (!user.isWizard && updateUserWizardDto.isWizard === true) {
            if (!updateUserWizardDto.languages || !updateUserWizardDto.subjects || !updateUserWizardDto.experience) {
                throw new BadRequestException('You must provide languages, subjects, experiences, and image when changing isWizard to true');
            }
            if (!updateUserWizardDto.experience.title || !updateUserWizardDto.experience.origin) {
                throw new BadRequestException('You must provide experience title and origin when changing isWizard to true');
            }
        }
        const updatedUser = await this.userModel.findOneAndUpdate({ _id: _id, isDisabled: false }, updateUserWizardDto, {new: true})
        return updatedUser;
    }
    
    async disable(_id: string): Promise<User> {
        const user = await this.userModel.findOneAndUpdate({ _id: _id }, { isDisabled: true }).exec();
        if (!user) {
            throw new NotFoundException(`User with id ${_id} not found`);
        }
        return user;
    }

    async able(_id: string): Promise<User> {
        const user = await this.userModel.findOneAndUpdate({ _id: _id }, { isDisabled: false }).exec();
        if (!user) {
            throw new NotFoundException(`User with id ${_id} not found`);
        }
        return user;
    }

    async getTopSellers() {
        const topSellers = await this.userModel.aggregate([
            { $match: { isWizard: true } },
            { $sort: { "experience.expJobs": -1 } },
            { $project: { name: 1, _id: 1, image: 1, 'experience.expJobs': 1 } },
            { $limit: 10 }
        ]);
    
        return topSellers;
    }

    async getTopRatedWizards() {
        const topRatedWizards = await this.userModel.aggregate([
            {
                $match: { isWizard: true, "experience.expJobs": { $gt: 0 } }
            },
            {
                $sort: { reviews: -1 }
            },
            {
                $project: {
                name: 1,
                _id: 1,
                image: 1,
                reviews: 1
                }
            },
            {
                $limit: 10
            }
            ]);
        
            return topRatedWizards;
        }

    async getCalendar(_id: string): Promise<User> {
        const user = await this.userModel.findOne({ _id: _id, isDisabled: false, role: { $ne: 'admin' }}, { calendar: 1 }).exec();
        if (!user) {
            throw new NotFoundException(`User with id ${_id} not found`);
        }
        return user;
    }
    
    
}
