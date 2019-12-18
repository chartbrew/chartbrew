FROM node:10

WORKDIR /code
COPY . .

RUN cd client && npm install
RUN cd server && npm install

EXPOSE 3000
EXPOSE 3210

# RUN npm run setup
ENTRYPOINT ["./entrypoint.sh"]